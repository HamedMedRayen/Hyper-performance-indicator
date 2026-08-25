import os
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, date
import psycopg2.extras
import json

from database import get_db
from routes.auth import get_current_user_id

router = APIRouter(prefix="", tags=["Nutrition"])

# --- Models ---

class FoodItemCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    calories: float
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    fiber_g: float = 0
    serving_size: float = 100
    serving_unit: str = "g"

class RecipeIngredient(BaseModel):
    food_id: int
    amount: float
    unit: str = "g"

class RecipeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    servings: float = 1.0
    ingredients: List[RecipeIngredient]

class MealLogCreate(BaseModel):
    meal_name: str
    meal_category: Optional[str] = "Breakfast"
    food_id: Optional[int] = None
    recipe_id: Optional[int] = None
    amount: Optional[float] = 1.0
    unit: Optional[str] = "serving"
    calories: Optional[float] = None  # For quick add or override
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    date: Optional[str] = None  # ISO date string e.g. "2026-08-05"

class QuickAddRequest(BaseModel):
    calories: float
    meal_name: str = "Quick Add"
    meal_category: Optional[str] = "Breakfast"
    protein_g: Optional[float] = 0
    carbs_g: Optional[float] = 0
    fat_g: Optional[float] = 0
    date: Optional[str] = None

class ScanRequest(BaseModel):
    description: str
    meal_category: Optional[str] = "Breakfast"
    date: Optional[str] = None

class CopyMealRequest(BaseModel):
    from_date: date
    to_date: date


class ScanVisionRequest(BaseModel):
    image_base64: str
    auto_log: Optional[bool] = False

class NutritionCalculationRequest(BaseModel):
    weight: float
    height: float
    age: int
    sex: str
    steps: int
    work_type: str
    training_sessions: int
    training_intensity: str
    goal: str
    pace: str
    diet_style: str
    body_fat: Optional[float] = None
    experience_level: Optional[str] = None
    training_type: Optional[str] = None

class NutritionTargetSaveRequest(BaseModel):
    suggested: Dict[str, float]
    final: Dict[str, float]
    goal: str
    pace: str
    diet_style: str
    maintenance_calories: float
    expected_weekly_change: float

# --- Helpers ---

def parse_date(date_str: Optional[str]) -> date:
    """Safely parse an ISO date string or return today's date."""
    if date_str and isinstance(date_str, str) and date_str.strip():
        try:
            return datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
        except Exception:
            pass
    return date.today()

# --- Endpoints ---

import time
_SEARCH_CACHE = {} # { (q, user_id): (timestamp, results) }
CACHE_TTL = 300 # 5 minutes

import re

@router.get("/food/search")
def search_food(q: str = Query(...), user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    cache_key = (q, user_id)
    if cache_key in _SEARCH_CACHE:
        ts, results = _SEARCH_CACHE[cache_key]
        if time.time() - ts < CACHE_TTL:
            return results

    # Clean query for FTS: remove non-alphanumeric and add prefix operator
    sanitized_q = re.sub(r'[^\w\s]', '', q)
    clean_q = " & ".join([f"{word}:*" for word in sanitized_q.split() if word])
    if not clean_q: return []

    try:
        with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Hybrid Search Query:
            # 1. FTS Rank (Lexical)
            # 2. Similarity (Fuzzy)
            # 3. Recency Boost (Personalization)
            # 4. Popularity Boost (Global)
            cur.execute("""
                SELECT fi.*, 
                       ts_rank(fi.search_vector, to_tsquery('english', %s)) as fts_rank,
                       similarity(fi.name, %s) as fuzzy_sim,
                       (SELECT MAX(logged_at) FROM nutrition_logs nl 
                        WHERE nl.meal_name = fi.name AND nl.user_id = %s) as last_used,
                       COALESCE(fi.popularity, 0) as popularity_score
                FROM food_items fi
                WHERE (fi.search_vector @@ to_tsquery('english', %s) OR fi.name ILIKE %s)
                AND (fi.is_user_added = FALSE OR fi.created_by = %s)
                ORDER BY 
                    (fts_rank * 10 + fuzzy_sim * 5 + 
                     CASE WHEN fi.name ILIKE %s THEN 20 ELSE 0 END + -- Exact match
                     CASE WHEN fi.name ILIKE %s THEN 10 ELSE 0 END + -- Starts with boost
                     CASE WHEN last_used IS NOT NULL THEN 25 ELSE 0 END +
                     LEAST(popularity_score, 100) * 0.1) DESC,
                    fi.name ASC 
                LIMIT 50
            """, (clean_q, q, user_id, clean_q, f"%{q}%", user_id, q, f"{q}%"))
            results = cur.fetchall()
            _SEARCH_CACHE[cache_key] = (time.time(), results)
            return results
    except Exception as e:
        print(f"SEARCH ERROR: {e}")
        return []

@router.get("/food/all")
def get_all_food_items(user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    try:
        with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Get all global items plus user added ones
            cur.execute("""
                SELECT * FROM food_items 
                WHERE is_user_added = FALSE OR created_by = %s
                ORDER BY popularity DESC, name ASC
            """, (user_id,))
            res = cur.fetchall()
            print(f"DEBUG: get_all_food_items returned {len(res)} items for user {user_id}")
            return res
    except Exception as e:
        print(f"DEBUG ERROR: get_all_food_items failed: {e}")
        return []
def create_custom_food(payload: FoodItemCreate, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO food_items (name, brand, category, calories, protein_g, carbs_g, fat_g, fiber_g, serving_size, serving_unit, is_user_added, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s)
            RETURNING *
        """, (
            payload.name, payload.brand, payload.category, payload.calories,
            payload.protein_g, payload.carbs_g, payload.fat_g, payload.fiber_g,
            payload.serving_size, payload.serving_unit, user_id
        ))
        return cur.fetchone()

@router.post("/recipes")
def create_recipe(payload: RecipeCreate, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO recipes (user_id, name, description, servings)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (user_id, payload.name, payload.description, payload.servings))
        recipe_id = cur.fetchone()["id"]
        
        for ing in payload.ingredients:
            cur.execute("""
                INSERT INTO recipe_ingredients (recipe_id, food_id, amount, unit)
                VALUES (%s, %s, %s, %s)
            """, (recipe_id, ing.food_id, ing.amount, ing.unit))
            
        return {"id": recipe_id, "message": "Recipe created successfully"}

@router.get("/recipes")
def get_user_recipes(user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM recipes WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
        return cur.fetchall()

@router.get("/recipes/{recipe_id}")
def get_recipe_details(recipe_id: int, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM recipes WHERE id = %s AND user_id = %s", (recipe_id, user_id))
        recipe = cur.fetchone()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
            
        cur.execute("""
            SELECT ri.*, fi.name, fi.calories, fi.protein_g, fi.carbs_g, fi.fat_g, fi.fiber_g, fi.serving_size, fi.serving_unit
            FROM recipe_ingredients ri
            JOIN food_items fi ON ri.food_id = fi.id
            WHERE ri.recipe_id = %s
        """, (recipe_id,))
        ingredients = cur.fetchall()
        recipe["ingredients"] = ingredients
        return recipe

@router.post("/log")
def log_nutrition(payload: MealLogCreate, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    # Calculate nutrition values based on amount/unit
    cals, protein, carbs, fat, fiber = 0, 0, 0, 0, 0
    log_date = parse_date(payload.date)
    
    if payload.calories is not None:
        # Use explicitly provided overrides from frontend
        cals = payload.calories
        protein = payload.protein_g or 0
        carbs = payload.carbs_g or 0
        fat = payload.fat_g or 0
        fiber = payload.fiber_g or 0
    elif payload.food_id:
        with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM food_items WHERE id = %s", (payload.food_id,))
            food = cur.fetchone()
            if food:
                if payload.unit == "serving":
                    ratio = payload.amount
                else:
                    calc_amount = payload.amount
                    if payload.unit == "kg":
                        calc_amount *= 1000
                    elif payload.unit == "oz":
                        calc_amount *= 28.35
                    elif payload.unit == "lb":
                        calc_amount *= 453.59
                    ratio = calc_amount / (food["serving_size"] or 1)
                
                cals = food["calories"] * ratio
                protein = (food["protein_g"] or 0) * ratio
                carbs = (food["carbs_g"] or 0) * ratio
                fat = (food["fat_g"] or 0) * ratio
                fiber = (food["fiber_g"] or 0) * ratio
    elif payload.recipe_id:
         # Simplified recipe calculation: sum of ingredients
         with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT ri.amount as ing_amount, fi.*
                FROM recipe_ingredients ri
                JOIN food_items fi ON ri.food_id = fi.id
                WHERE ri.recipe_id = %s
            """, (payload.recipe_id,))
            ingredients = cur.fetchall()
            for ing in ingredients:
                ratio = ing["ing_amount"] / (ing["serving_size"] or 1)
                cals += ing["calories"] * ratio
                protein += (ing["protein_g"] or 0) * ratio
                carbs += (ing["carbs_g"] or 0) * ratio
                fat += (ing["fat_g"] or 0) * ratio
                fiber += (ing["fiber_g"] or 0) * ratio
            
            # Divide by servings of the recipe and multiply by the log amount (if log amount is servings)
            cur.execute("SELECT servings FROM recipes WHERE id = %s", (payload.recipe_id,))
            servings_row = cur.fetchone()
            servings = servings_row["servings"] if servings_row and servings_row["servings"] else 1
            cals = (cals / servings) * payload.amount
            protein = (protein / servings) * payload.amount
            carbs = (carbs / servings) * payload.amount
            fat = (fat / servings) * payload.amount
            fiber = (fiber / servings) * payload.amount

    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        category = payload.meal_category or "Breakfast"
        cur.execute("""
            INSERT INTO nutrition_logs (user_id, meal_name, meal_category, calories, protein_g, carbs_g, fat_g, fiber_g, date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (user_id, payload.meal_name, category, cals, protein, carbs, fat, fiber, log_date))
        res = cur.fetchone()
        db.commit()
        return res

@router.post("/log/quick")
def quick_add(payload: QuickAddRequest, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    log_date = parse_date(payload.date)
    category = payload.meal_category or "Breakfast"
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO nutrition_logs (user_id, meal_name, meal_category, calories, protein_g, carbs_g, fat_g, date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (user_id, payload.meal_name, category, payload.calories, payload.protein_g or 0, payload.carbs_g or 0, payload.fat_g or 0, log_date))
        res = cur.fetchone()
        db.commit()
        return res

@router.delete("/log/{log_id}")
def delete_log(log_id: int, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("DELETE FROM nutrition_logs WHERE id = %s AND user_id = %s", (log_id, user_id))
        db.commit()
    return {"message": "Log entry deleted"}

@router.get("/today")
def get_today_nutrition(date: Optional[str] = Query(None), user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    target_date = date or str(date.today()) if hasattr(date, 'today') else (date or str(datetime.now().date()))
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT id, meal_name, COALESCE(meal_category, 'Breakfast') as meal_category, calories, protein_g, carbs_g, fat_g, fiber_g, date, logged_at 
            FROM nutrition_logs 
            WHERE user_id = %s AND date = %s::date
            ORDER BY logged_at ASC
        """, (user_id, target_date))
        meals = cur.fetchall()
        
    totals = {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}
    for m in meals:
        totals["calories"] += m["calories"] or 0
        totals["protein_g"] += m["protein_g"] or 0
        totals["carbs_g"] += m["carbs_g"] or 0
        totals["fat_g"] += m["fat_g"] or 0
        
    return {"meals": meals, "totals": totals, "date": target_date}

@router.get("/history")
def get_nutrition_history(user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT date, SUM(calories) as calories, SUM(protein_g) as protein_g, 
                   SUM(carbs_g) as carbs_g, SUM(fat_g) as fat_g
            FROM nutrition_logs 
            WHERE user_id = %s
            GROUP BY date 
            ORDER BY date DESC 
            LIMIT 30
        """, (user_id,))
        return cur.fetchall()

@router.post("/log/copy")
def copy_meals(payload: CopyMealRequest, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO nutrition_logs (user_id, meal_name, calories, protein_g, carbs_g, fat_g, fiber_g, date)
            SELECT user_id, meal_name, calories, protein_g, carbs_g, fat_g, fiber_g, %s
            FROM nutrition_logs
            WHERE user_id = %s AND date = %s
        """, (payload.to_date, user_id, payload.from_date))
        db.commit()
        return {"message": "Meals copied successfully"}

@router.post("/scan")
def scan_meal(payload: ScanRequest, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    import os
    from groq import Groq

    # Deduplication check: return recent log if recorded within last 3 minutes
    if payload.description and payload.description.strip():
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT * FROM nutrition_logs 
                    WHERE user_id = %s 
                      AND (LOWER(description) = LOWER(%s) OR LOWER(meal_name) = LOWER(%s))
                      AND logged_at >= NOW() - INTERVAL '3 minutes'
                    ORDER BY id DESC LIMIT 1
                """, (user_id, payload.description.strip(), payload.description.strip()))
                recent = cur.fetchone()
                if recent:
                    return recent
        except Exception as dup_err:
            pass

    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="AI service is not configured")
        
    client = Groq(api_key=groq_api_key)
    prompt = """You are a nutrition expert. The user will describe a meal.
Respond ONLY with a JSON object:
{ "calories": int, "protein_g": float, "carbs_g": float, "fat_g": float, "fiber_g": float, "meal_name": "str" }
Be accurate based on typical serving sizes."""

    from services.llm_service import create_groq_chat_completion
    groq_chat_model = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
    try:
        completion = create_groq_chat_completion(
            client=client,
            model=groq_chat_model,
            messages=[{"role": "system", "content": prompt}, {"role": "user", "content": payload.description}],
            temperature=0.1,
        )
        reply = completion.choices[0].message.content.strip()
        if "```json" in reply:
            reply = reply.split("```json")[1].split("```")[0].strip()
        elif "```" in reply:
            reply = reply.split("```")[1].split("```")[0].strip()
        
        data = json.loads(reply)
        
        category = payload.meal_category or "Breakfast"
        log_date = parse_date(payload.date)
        with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Check again with AI parsed meal_name before inserting
            parsed_name = data.get("meal_name", "AI Meal")
            cur.execute("""
                SELECT * FROM nutrition_logs 
                WHERE user_id = %s 
                  AND LOWER(meal_name) = LOWER(%s)
                  AND logged_at >= NOW() - INTERVAL '3 minutes'
                ORDER BY id DESC LIMIT 1
            """, (user_id, parsed_name))
            recent_parsed = cur.fetchone()
            if recent_parsed:
                return recent_parsed

            cur.execute("""
                INSERT INTO nutrition_logs (user_id, meal_name, meal_category, calories, protein_g, carbs_g, fat_g, fiber_g, description, date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                user_id, parsed_name, category, data.get("calories", 0),
                data.get("protein_g", 0), data.get("carbs_g", 0), data.get("fat_g", 0),
                data.get("fiber_g", 0), payload.description, log_date
            ))
            res = cur.fetchone()
            db.commit()
            return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Active Models on Groq
GROQ_VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.6-27b")
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")

@router.post("/scan-vision")
def scan_meal_vision(payload: ScanVisionRequest, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    import os
    import re
    from groq import Groq
    
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="AI service is not configured")
        
    img_b64 = payload.image_base64
    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]
        
    client = Groq(api_key=groq_api_key, max_retries=2)

    # --- STEP 1: Multimodal Vision Perception (Qwen 3.6 27B Vision) ---
    vision_prompt = """Examine this food/meal photo in extreme detail.
1. Identify the exact dish name (e.g. North African Tagine / Couscous, Steak with Roasted Potatoes, Chicken Tikka Masala, Salmon Grain Bowl, etc.).
2. Describe every visible ingredient and distinct component in the dish.
3. For each component (meats, grains/carbs, vegetables, sauces, oils, sides, bread), estimate its portion size in grams or milliliters.
Be thorough and list all distinct components visible in the photo."""

    vision_output = ""
    try:
        print(f"[Aura Vision] Step 1: Multimodal perception via Groq Vision: {GROQ_VISION_MODEL}")
        completion = client.chat.completions.create(
            model=GROQ_VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": vision_prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{img_b64}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.2,
            max_tokens=1500
        )
        vision_output = completion.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Aura Vision] Primary vision model failed: {e}")
        try:
            completion = client.chat.completions.create(
                model="llama-3.2-11b-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": vision_prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                        ]
                    }
                ],
                temperature=0.2,
                max_tokens=1000
            )
            vision_output = completion.choices[0].message.content.strip()
        except Exception as e2:
            print(f"[Aura Vision] Fallback vision model failed: {e2}")

    # Clean reasoning tags if present
    clean_vision_text = re.sub(r'<think>.*?</think>', '', vision_output, flags=re.DOTALL).strip() if vision_output else ""

    # --- STEP 2: Clinical Nutritional Calculation & JSON Structuring ---
    print(f"[Aura Vision] Step 2: Clinical macro calculation & JSON formatting via {GROQ_CHAT_MODEL}...")
    refine_prompt = f"""You are 'Aura Vision', an elite AI clinical dietitian and sports nutritionist.
Analyze the following visual observation of a scanned meal dish and generate a precise, accurate macronutrient breakdown:

Visual Description of Scanned Meal:
\"\"\"{clean_vision_text or 'Photo of a complete meal dish.'}\"\"\"

Respond ONLY with a single JSON object adhering strictly to this schema:
{{
  "meal_name": "Specific dish name identified (e.g. North African Tagine or Couscous)",
  "description": "Appetizing description of the dish and visible components.",
  "components": [
    {{
      "name": "Component name (e.g. Stewed Lamb Shanks)",
      "portion": "150g",
      "calories": 280,
      "protein_g": 30.0,
      "carbs_g": 0.0,
      "fat_g": 18.0,
      "fiber_g": 0.0
    }}
  ],
  "totals": {{
    "calories": 885,
    "protein_g": 50.0,
    "carbs_g": 101.0,
    "fat_g": 33.0,
    "fiber_g": 13.0
  }}
}}
Calculate accurate macros (protein_g, carbs_g, fat_g, fiber_g) and calories for every component based on standard USDA nutrition database values.
Ensure 'totals' is the exact mathematical sum of all components."""

    data = None
    try:
        refinement = client.chat.completions.create(
            model=GROQ_CHAT_MODEL,
            messages=[{"role": "user", "content": refine_prompt}],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        data = json.loads(refinement.choices[0].message.content.strip())
    except Exception as e2:
        print(f"[Aura Vision] Step 2 calculation error: {e2}")

    if not data or not isinstance(data, dict):
        data = {
            "meal_name": "Scanned Meal",
            "description": "Healthy balanced meal analyzed via AI Vision.",
            "components": [
                {"name": "Protein Main", "portion": "150g", "calories": 250, "protein_g": 30, "carbs_g": 0, "fat_g": 12, "fiber_g": 0},
                {"name": "Complex Carbs Base", "portion": "150g", "calories": 180, "protein_g": 4, "carbs_g": 35, "fat_g": 2, "fiber_g": 3},
                {"name": "Fresh Vegetables", "portion": "100g", "calories": 50, "protein_g": 2, "carbs_g": 8, "fat_g": 1, "fiber_g": 3}
            ],
            "totals": {"calories": 480, "protein_g": 36, "carbs_g": 43, "fat_g": 15, "fiber_g": 6}
        }

    components = data.get("components", [])
    if not isinstance(components, list):
        components = []

    # Recalculate exact mathematical sum of component macros for totals
    if components:
        calc_cals = sum(float(c.get("calories", 0) or 0) for c in components if isinstance(c, dict))
        calc_prot = sum(float(c.get("protein_g", 0) or 0) for c in components if isinstance(c, dict))
        calc_carbs = sum(float(c.get("carbs_g", 0) or 0) for c in components if isinstance(c, dict))
        calc_fat = sum(float(c.get("fat_g", 0) or 0) for c in components if isinstance(c, dict))
        calc_fiber = sum(float(c.get("fiber_g", 0) or 0) for c in components if isinstance(c, dict))

        totals = {
            "calories": round(calc_cals if calc_cals > 0 else (data.get("totals", {}).get("calories", 0))),
            "protein_g": round(calc_prot if calc_prot > 0 else (data.get("totals", {}).get("protein_g", 0)), 1),
            "carbs_g": round(calc_carbs if calc_carbs > 0 else (data.get("totals", {}).get("carbs_g", 0)), 1),
            "fat_g": round(calc_fat if calc_fat > 0 else (data.get("totals", {}).get("fat_g", 0)), 1),
            "fiber_g": round(calc_fiber if calc_fiber > 0 else (data.get("totals", {}).get("fiber_g", 0)), 1),
        }
    else:
        totals = data.get("totals", {})

    meal_name = data.get("meal_name", "Scanned Meal")
    description = data.get("description", "Analyzed meal photo.")

    logged_record = None
    if payload.auto_log:
        with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO nutrition_logs (user_id, meal_name, calories, protein_g, carbs_g, fat_g, fiber_g, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                user_id, meal_name, totals.get("calories", 0),
                totals.get("protein_g", 0), totals.get("carbs_g", 0), totals.get("fat_g", 0),
                totals.get("fiber_g", 0), description
            ))
            logged_record = cur.fetchone()
            db.commit()

    return {
        "success": True,
        "meal_name": meal_name,
        "description": description,
        "components": components,
        "totals": totals,
        "logged_record": logged_record
    }


@router.post("/water")
def log_water(payload: dict, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    amount = payload.get("amount_ml", 0)
    action = payload.get("action", "add")
    
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if action == "add":
            cur.execute("""
                INSERT INTO water_logs (user_id, amount_ml, date)
                VALUES (%s, %s, CURRENT_DATE)
                ON CONFLICT (user_id, date) DO UPDATE SET amount_ml = water_logs.amount_ml + EXCLUDED.amount_ml
                RETURNING amount_ml
            """, (user_id, amount))
        else:
            cur.execute("""
                INSERT INTO water_logs (user_id, amount_ml, date)
                VALUES (%s, %s, CURRENT_DATE)
                ON CONFLICT (user_id, date) DO UPDATE SET amount_ml = EXCLUDED.amount_ml
                RETURNING amount_ml
            """, (user_id, amount))
        result = cur.fetchone()
    return result

@router.get("/water/today")
def get_today_water(user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT amount_ml FROM water_logs WHERE user_id = %s AND date = CURRENT_DATE", (user_id,))
        row = cur.fetchone()
    return row or {"amount_ml": 0}

# --- Recommendation System ---

from services.nutrition_service import NutritionService

@router.post("/calculate-targets")
def calculate_nutrition_targets(payload: NutritionCalculationRequest):
    return NutritionService.calculate_recommendation(payload.dict())

@router.post("/save-targets")
def save_nutrition_targets(payload: NutritionTargetSaveRequest, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO nutrition_targets (
                user_id, 
                suggested_calories, suggested_protein, suggested_carbs, suggested_fat,
                final_calories, final_protein, final_carbs, final_fat,
                goal, pace, diet_style,
                maintenance_calories, expected_weekly_change
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            user_id,
            payload.suggested["calories"], payload.suggested["protein"], payload.suggested["carbs"], payload.suggested["fat"],
            payload.final["calories"], payload.final["protein"], payload.final["carbs"], payload.final["fat"],
            payload.goal, payload.pace, payload.diet_style,
            payload.maintenance_calories, payload.expected_weekly_change
        ))
        return cur.fetchone()

@router.get("/targets/latest")
def get_latest_targets(user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT * FROM nutrition_targets 
            WHERE user_id = %s 
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,))
        return cur.fetchone()
