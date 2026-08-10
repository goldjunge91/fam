#!/usr/bin/env bash

set -euo pipefail

# Configuration
SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"

create_single_user() {
  local custom_email="${1:-}"
  local custom_password="${2:-}"
  local custom_name="${3:-}"
  local custom_household="${4:-}"

  # Generate random suffix if email is not provided
  local random_suffix=$((100000 + RANDOM % 900000))
  local email="${custom_email:-tester_${random_suffix}@example.com}"
  local password="${custom_password:-Passwort123!}"
  local display_name="${custom_name:-Test User ${random_suffix}}"
  local household_name="${custom_household:-Haushalt ${display_name}}"

  echo "------------------------------------------------------------"
  echo "⏳ Erstelle Nutzer: ${email}..."

  # 1. User via Supabase Admin Auth API erstellen
  local user_response
  user_response=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "'"${email}"'",
      "password": "'"${password}"'",
      "email_confirm": true,
      "user_metadata": { "display_name": "'"${display_name}"'" }
    }')

  local user_id
  user_id=$(echo "${user_response}" | jq -r '.id // empty')

  if [ -z "${user_id}" ] || [ "${user_id}" = "null" ]; then
    echo "❌ Fehler beim Erstellen des Nutzers:"
    echo "${user_response}" | jq .
    return 1
  fi

  # 2. Profile eintragen
  local now_iso
  now_iso=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  curl -s -X POST "${SUPABASE_URL}/rest/v1/profiles" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d '{
      "id": "'"${user_id}"'",
      "display_name": "'"${display_name}"'",
      "onboarding_completed_at": "'"${now_iso}"'",
      "updated_at": "'"${now_iso}"'"
    }' > /dev/null

  # 3. Haushalt erstellen
  local household_response
  household_response=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/households" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d '{
      "name": "'"${household_name}"'",
      "created_by": "'"${user_id}"'"
    }')

  local household_id
  household_id=$(echo "${household_response}" | jq -r '.[0].id // empty')

  if [ -z "${household_id}" ] || [ "${household_id}" = "null" ]; then
    echo "❌ Fehler beim Erstellen des Haushalts:"
    echo "${household_response}" | jq .
    return 1
  fi

  # 4. Nutzer als Admin zum Haushalt hinzufügen
  curl -s -X POST "${SUPABASE_URL}/rest/v1/household_members" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
      "household_id": "'"${household_id}"'",
      "user_id": "'"${user_id}"'",
      "role": "admin"
    }' > /dev/null

  # 5. Standard-Lagerorte anlegen
  curl -s -X POST "${SUPABASE_URL}/rest/v1/storage_locations" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '[
      { "household_id": "'"${household_id}"'", "name": "Kühlschrank", "kind": "fridge", "sort_order": 0 },
      { "household_id": "'"${household_id}"'", "name": "Tiefkühltruhe", "kind": "freezer", "sort_order": 1 },
      { "household_id": "'"${household_id}"'", "name": "Abstellkammer", "kind": "pantry", "sort_order": 2 }
    ]' > /dev/null

  # 6. Beispiels-Produkte anlegen und zur Einkaufsliste hinzufügen
  local products_json='[
    {
      "name": "Bio Vollmilch 3.5%",
      "brand": "REWE Bio",
      "kcal_per_100": 64,
      "protein_g_per_100": 3.4,
      "carbs_g_per_100": 4.7,
      "fat_g_per_100": 3.5,
      "serving_size_g": 200,
      "unit": "l",
      "category": "Milchprodukte",
      "quantity": 2,
      "price_estimate": 1.19
    },
    {
      "name": "Bio Freilandeier 10er",
      "brand": "Alnatura",
      "kcal_per_100": 155,
      "protein_g_per_100": 13,
      "carbs_g_per_100": 1.1,
      "fat_g_per_100": 11,
      "serving_size_g": 60,
      "unit": "package",
      "category": "Eier & Kühlung",
      "quantity": 1,
      "price_estimate": 3.29
    },
    {
      "name": "Vollkornbrot 500g",
      "brand": "Harry Brot",
      "kcal_per_100": 210,
      "protein_g_per_100": 7.5,
      "carbs_g_per_100": 38,
      "fat_g_per_100": 1.2,
      "serving_size_g": 50,
      "unit": "piece",
      "category": "Brot & Backwaren",
      "quantity": 1,
      "price_estimate": 1.99
    },
    {
      "name": "Bio Bananen",
      "brand": "Fairtrade",
      "kcal_per_100": 89,
      "protein_g_per_100": 1.1,
      "carbs_g_per_100": 22.8,
      "fat_g_per_100": 0.3,
      "serving_size_g": 120,
      "unit": "kg",
      "category": "Obst & Gemüse",
      "quantity": 1.5,
      "price_estimate": 2.49
    },
    {
      "name": "Kölln Echte Kernige Haferflocken",
      "brand": "Kölln",
      "kcal_per_100": 370,
      "protein_g_per_100": 13.5,
      "carbs_g_per_100": 58.7,
      "fat_g_per_100": 7,
      "serving_size_g": 50,
      "unit": "package",
      "category": "Müsli & Getreide",
      "quantity": 2,
      "price_estimate": 1.79
    }
  ]'

  local product_count
  product_count=$(echo "${products_json}" | jq '. | length')
  local added_count=0

  for (( i=0; i<product_count; i++ )); do
    local p_name p_brand p_kcal p_protein p_carbs p_fat p_serving p_unit p_category p_quantity p_price
    p_name=$(echo "${products_json}" | jq -r ".[$i].name")
    p_brand=$(echo "${products_json}" | jq -r ".[$i].brand")
    p_kcal=$(echo "${products_json}" | jq -r ".[$i].kcal_per_100")
    p_protein=$(echo "${products_json}" | jq -r ".[$i].protein_g_per_100")
    p_carbs=$(echo "${products_json}" | jq -r ".[$i].carbs_g_per_100")
    p_fat=$(echo "${products_json}" | jq -r ".[$i].fat_g_per_100")
    p_serving=$(echo "${products_json}" | jq -r ".[$i].serving_size_g")
    p_unit=$(echo "${products_json}" | jq -r ".[$i].unit")
    p_category=$(echo "${products_json}" | jq -r ".[$i].category")
    p_quantity=$(echo "${products_json}" | jq -r ".[$i].quantity")
    p_price=$(echo "${products_json}" | jq -r ".[$i].price_estimate")

    # Produkt abfragen oder anlegen
    local existing_prod
    existing_prod=$(curl -s -G "${SUPABASE_URL}/rest/v1/products" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      --data-urlencode "name=eq.${p_name}" \
      --data-urlencode "select=id")

    local product_id
    product_id=$(echo "${existing_prod}" | jq -r '.[0].id // empty')

    if [ -z "${product_id}" ] || [ "${product_id}" = "null" ]; then
      local new_prod
      new_prod=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/products" \
        -H "apikey: ${SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d '{
          "name": "'"${p_name}"'",
          "brand": "'"${p_brand}"'",
          "kcal_per_100": '"${p_kcal}"',
          "protein_g_per_100": '"${p_protein}"',
          "carbs_g_per_100": '"${p_carbs}"',
          "fat_g_per_100": '"${p_fat}"',
          "serving_size_g": '"${p_serving}"',
          "source": "manual",
          "created_by": "'"${user_id}"'"
        }')
      product_id=$(echo "${new_prod}" | jq -r '.[0].id // empty')
    fi

    # Zur Einkaufsliste hinzufügen
    local prod_id_field="null"
    if [ -n "${product_id}" ] && [ "${product_id}" != "null" ]; then
      prod_id_field="\"${product_id}\""
    fi

    local shop_res
    shop_res=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/shopping_list_items" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=representation" \
      -d '{
        "household_id": "'"${household_id}"'",
        "product_id": '"${prod_id_field}"',
        "name": "'"${p_name}"'",
        "quantity": '"${p_quantity}"',
        "unit": "'"${p_unit}"'",
        "category": "'"${p_category}"'",
        "price_estimate": '"${p_price}"',
        "added_by": "'"${user_id}"'",
        "sort_index": '"${i}"'
      }')

    local item_id
    item_id=$(echo "${shop_res}" | jq -r '.[0].id // empty')
    if [ -n "${item_id}" ] && [ "${item_id}" != "null" ]; then
      added_count=$((added_count + 1))
    fi
  done

  echo "✅ Account erfolgreich erstellt!"
  echo " 📧 E-Mail:       ${email}"
  echo " 🔑 Passwort:     ${password}"
  echo " 👤 Name:         ${display_name}"
  echo " 🏡 Haushalt:     ${household_name}"
  echo " 🆔 Household ID: ${household_id}"
  echo " 🛒 Einkaufsliste: ${added_count} Produkte hinzugefügt"
  echo " 🆔 User ID:      ${user_id}"
  echo "------------------------------------------------------------"
}

# Main Execution
count=1

if [ "${1:-}" = "-c" ] || [ "${1:-}" = "--count" ]; then
  count="${2:-1}"
elif [[ "${1:-}" =~ ^[0-9]+$ ]]; then
  count="${1}"
fi

if [ "${count}" -gt 1 ]; then
  echo "🚀 Erstelle ${count} Test-Nutzer (jeweils mit eigenem Haushalt & Produkten)..."
  for (( c=1; c<=count; c++ )); do
    create_single_user
  done
else
  if [ -n "${1:-}" ] && [[ "${1}" == *"@"* ]]; then
    create_single_user "${1}" "${2:-}" "${3:-}" "${4:-}"
  else
    create_single_user
  fi
fi
