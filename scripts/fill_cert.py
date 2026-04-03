"""
fill_cert.py — Rabies Certificate Generator for People Helping Pets
Usage: python fill_cert.py <vaccination_id>

Pulls data from Supabase for the given vaccination ID,
fills out NASPHV Form 51 (RabiesVacCert.pdf), and saves
a completed PDF to ./certificates/cert_<vaccination_id>.pdf
"""

import sys
import os
import io
import json
import requests
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from pypdf import PdfReader, PdfWriter

# ─── CONFIG ───────────────────────────────────────────────────────────────────

SUPABASE_URL  = "https://lzfhdzklfmmxbfmyscfl.supabase.co"   # e.g. https://abcd1234.supabase.co
SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmhkemtsZm1teGJmbXlzY2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzA4MTAsImV4cCI6MjA4OTUwNjgxMH0.3nDc8afk-_ufnSQ4ozKCdaYheMZkm6qjNf9ibyo03uk"            # anon key is fine for read
TEMPLATE_PDF  = "RabiesVacCert.pdf"
OUTPUT_DIR    = "certificates"

# Hardcoded vet info
VET_NAME      = "Ana Valbuena"
VET_LICENSE   = "[LICENSE-REDACTED]"
VET_ADDRESS   = "Chicago, IL"                         # update to full address if needed

# ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

def sb_get(table, query):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    print(f"DEBUG: GET {url}")
    r = requests.get(url, headers=HEADERS)
    print(f"DEBUG: status={r.status_code} body={r.text[:200]}")
    r.raise_for_status()
    return r.json()

def fetch_vaccination_data(vaccination_id):
    """
    Returns a dict with everything needed for the certificate:
    vaccination, pet, and client records.
    """
    # 1. Vaccination
    vacc_rows = sb_get("vaccinations", f"id=eq.{vaccination_id}&select=*")
    if not vacc_rows:
        raise ValueError(f"No vaccination found with id={vaccination_id}")
    vacc = vacc_rows[0]

    # 2. Pet
    pet_rows = sb_get("pets", f"id=eq.{vacc['pet_id']}&select=*")
    if not pet_rows:
        raise ValueError(f"No pet found with id={vacc['pet_id']}")
    pet = pet_rows[0]

    # 3. Client
    client_rows = sb_get("clients", f"id=eq.{pet['client_id']}&select=*")
    if not client_rows:
        raise ValueError(f"No client found with id={pet['client_id']}")
    client = client_rows[0]

    return {"vacc": vacc, "pet": pet, "client": client}

# ─── FIELD MAPPING ────────────────────────────────────────────────────────────

def build_field_values(data):
    """
    Maps Supabase data to NASPHV Form 51 field IDs.
    Returns a list of {field_id, page, value} dicts.
    """
    vacc   = data["vacc"]
    pet    = data["pet"]
    client = data["client"]

    # ── Owner name: split on first space ──────────────────────────────────────
    name_parts = (client.get("name") or "").strip().split(" ", 1)
    first_name = name_parts[0] if len(name_parts) > 0 else ""
    last_name  = name_parts[1] if len(name_parts) > 1 else ""

    # ── Vaccination date & next due ───────────────────────────────────────────
    vacc_date_str = vacc.get("date") or vacc.get("created_at", "")[:10]
    try:
        vacc_date = date.fromisoformat(vacc_date_str[:10])
    except ValueError:
        vacc_date = date.today()

    next_due = vacc_date + relativedelta(years=1)   # PHP uses 1-yr vaccine

    # ── Species radio: /0=Dog /1=Cat /2=Ferret /3=Other ──────────────────────
    species_map = {"dog": "/0", "cat": "/1", "ferret": "/2"}
    species_val = species_map.get((pet.get("species") or "").lower(), "/3")

    # ── Sex radio: /0=Male /1=Female ─────────────────────────────────────────
    altered = (pet.get("altered") or "").lower()
    is_neutered = altered in ("yes", "true", "1", "neutered", "spayed")

    sex_raw = (pet.get("sex") or "").lower()
    sex_map = {"male": "/0", "female": "/1", "m": "/0", "f": "/1"}
    sex_val = sex_map.get(sex_raw, None)

    # ── Age: show as number + unit ────────────────────────────────────────────
    age_val = str(pet["age"]) if pet.get("age") else ""
    # Months/Years radio: /0=Months /1=Years — default to Years
    age_unit_val = "/1"   # always Years unless you store unit separately

    # ── Size radio: /0=Under 20 lbs /1=20-50 lbs /2=Over 50 lbs ─────────────
    weight = pet.get("weight")
    if weight is None:
        size_val = "/0"
    elif weight < 20:
        size_val = "/0"
    elif weight <= 50:
        size_val = "/1"
    else:
        size_val = "/2"

    # ── Neutered checkbox ─────────────────────────────────────────────────────
    altered = (pet.get("altered") or "").lower()
    neutered_val = "/Yes" if is_neutered else "/Off"

    # ── Microchip ─────────────────────────────────────────────────────────────
    microchip_val = pet.get("microchip_number") or ""

    # ── Manufacturer: first 3 letters of product name ─────────────────────────
    product = vacc.get("product_name") or ""
    man1 = product[0] if len(product) > 0 else ""
    man2 = product[1] if len(product) > 1 else ""
    man3 = product[2] if len(product) > 2 else ""

    fields = [
        # Owner info
        {"field_id": "Last Name",                    "page": 1, "value": last_name},
        {"field_id": "First Name",                   "page": 1, "value": first_name},
        {"field_id": "Telephone #",                  "page": 1, "value": client.get("phone") or ""},
        {"field_id": "Owner's Address",  "page": 1, "value": ""},
        {"field_id": "Street",       "page": 1, "value": client.get("street") or client.get("address") or ""}, 
        {"field_id": "City",         "page": 1, "value": client.get("city") or ""},
        {"field_id": "State",        "page": 1, "value": client.get("state") or ""},
        {"field_id": "Zip Code",     "page": 1, "value": client.get("zip") or ""},

        # Animal info
        {"field_id": "Animal Name",                  "page": 1, "value": pet.get("name") or ""},
        {"field_id": "Species",                      "page": 1, "value": species_val,   "type": "radio_group"},
        {"field_id": "Age",                          "page": 1, "value": age_val},
        {"field_id": "Months/Years",                 "page": 1, "value": age_unit_val,  "type": "radio_group"},
        {"field_id": "Size",                         "page": 1, "value": size_val,      "type": "radio_group"},
        {"field_id": "Sex",  "page": 1, "value": sex_val,  "type": "radio_group"} if sex_val and not is_neutered else {"field_id": "Sex", "page": 1, "value": "/Off", "type": "radio_group"},
        {"field_id": "Neutered",                     "page": 1, "value": neutered_val},
        {"field_id": "Predominent Breed",            "page": 1, "value": pet.get("breed") or ""},
        {"field_id": "Predominemt Colors/Markings",  "page": 1, "value": vacc.get("colors_markings") or ""},
        {"field_id": "Microchip #",                  "page": 1, "value": microchip_val},

        # Animal control license — PHP uses 1 yr
        {"field_id": "AC 1 year",                    "page": 1, "value": "/Yes"},

        # Vaccine info
        {"field_id": "Rabies Tag #",  "page": 1, "value": vacc.get("rabies_tag_number") or ""},
        {"field_id": "Date Vaccinated",              "page": 1, "value": vacc_date.strftime("%m/%d/%Y")},
        {"field_id": "Next Vaccination Date",        "page": 1, "value": next_due.strftime("%m/%d/%Y")},
        {"field_id": "Product Name",                 "page": 1, "value": product},
        {"field_id": "Manufacturer",                 "page": 1, "value": man1},
        {"field_id": "Man2",                         "page": 1, "value": man2},
        {"field_id": "Man3",                         "page": 1, "value": man3},
        {"field_id": "License Number",               "page": 1, "value": vacc.get("lot_number") or ""},
        {"field_id": "Vaccine Serial Number",        "page": 1, "value": vacc.get("serial_number") or ""},
        {"field_id": "USDA Licensed Vaccine",        "page": 1, "value": "/0",          "type": "radio_group"},
        {"field_id": "Dose",                         "page": 1, "value": "/0",          "type": "radio_group"},

        # Vet info (hardcoded)
        {"field_id": "Veterinarian's Name",          "page": 1, "value": VET_NAME},
        {"field_id": "Veterinarian's address",       "page": 1, "value": VET_ADDRESS},
    ]

    return fields

# ─── PDF FILLING ──────────────────────────────────────────────────────────────
SIGNATURE_IMG = "ana_signature.png"   # path to signature image

def build_signature_overlay(pdf_width=612, pdf_height=792):
    """Creates a single-page PDF overlay with the signature image."""
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(pdf_width, pdf_height))
    sig = ImageReader(SIGNATURE_IMG)
    # Placed just above the 'Veterinarian's Signature' label
    c.drawImage(sig, 313, 445, width=294, height=35, mask='auto')
    c.save()
    buf.seek(0)
    return buf

def fill_certificate(fields, vaccination_id):
    reader = PdfReader(TEMPLATE_PDF)
    writer = PdfWriter(clone_from=reader)

    # Fill all text and checkbox fields
    field_values = {f["field_id"]: f["value"] for f in fields}
    writer.update_page_form_field_values(
        writer.pages[0],
        field_values,
        auto_regenerate=False
    )

    # Radio buttons: set /AS on each widget annotation by matching parent_T
    radio_fields = {f["field_id"]: f["value"] for f in fields if f.get("type") == "radio_group"}
    if radio_fields:
        from pypdf.generic import NameObject
        page = writer.pages[0]
        for annot in page["/Annots"]:
            annot_obj = annot.get_object()
            # Radio widgets have no /T themselves — name is on the parent
            parent = annot_obj.get("/Parent")
            if not parent:
                continue
            parent_name = str(parent.get_object().get("/T", ""))
            if parent_name not in radio_fields:
                continue
            target_value = radio_fields[parent_name]
            # Check if this widget's AP/N dict contains the target value as a key
            ap = annot_obj.get("/AP")
            if not ap:
                continue
            n = ap.get_object().get("/N")
            if not n:
                continue
            n_keys = list(n.get_object().keys())
            if target_value in n_keys:
                annot_obj.update({NameObject("/AS"): NameObject(target_value)})
                parent.get_object().update({NameObject("/V"): NameObject(target_value)})
            else:
                annot_obj.update({NameObject("/AS"): NameObject("/Off")})
# Overlay signature image
    if os.path.exists(SIGNATURE_IMG):
        from pypdf import PdfReader as _PR
        overlay = _PR(build_signature_overlay())
        writer.pages[0].merge_page(overlay.pages[0])
    writer.set_need_appearances_writer(True)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, f"cert_{vaccination_id}.pdf")
    with open(out_path, "wb") as f:
        writer.write(f)

    return out_path

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) != 2:
        print("Usage: python fill_cert.py <vaccination_id>")
        sys.exit(1)

    vaccination_id = sys.argv[1]
    print(f"Fetching data for vaccination id={vaccination_id}...")

    data   = fetch_vaccination_data(vaccination_id)
    print("DEBUG vacc:", data["vacc"])
    fields = build_field_values(data)
    out    = fill_certificate(fields, vaccination_id)

    print(f"✅ Certificate saved to: {out}")

if __name__ == "__main__":
    main()
