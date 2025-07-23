from flask import Flask, request, jsonify
import pandas as pd
from flask_cors import CORS
import numpy as np
import json
import os
import re

app = Flask(__name__)
CORS(app)

# def remove_tashkeel(text):
#     tashkeel_pattern = r'[\u0617-\u061A\u064B-\u0652]'
#     # This will replace all Hamza Alef variations with a normal Alef (ا)
#     hamza_alef_pattern = r'[\u0622\u0623\u0625\u0671]'
#     a = re.sub(tashkeel_pattern, '', text)
#     b = re.sub(hamza_alef_pattern, 'ا', a)
#     return b
chars_to_normalize = set()


def normalize_arabic_text(text):
    # http://www.isthisthingon.org/unicode/index.phtml?page=U0&subpage=6
    standard_arabic_characters = r'[^\u0621-\u063A\u0641-\u064A\s]'
    global chars_to_normalize
    non_standard_chars = re.findall(standard_arabic_characters, text)
    chars_to_normalize.update(non_standard_chars)

    # Define a pattern for Arabic diacritics (tashkeel) including Warsh-specific ones
    arabic_diacritics = re.compile(r"""
        ّ    | # Shadda
        َ    | # Fatha
        ً    | # Tanwin Fath
        ُ    | # Damma
        ٌ    | # Tanwin Damm
        ِ    | # Kasra
        ٍ    | # Tanwin Kasr
        ْ    | # Sukun
        ـ    | # Tatweel (Kashida)
        ٱ    | # Alif Wasla (Warsh-specific)
        ۞    | # Rub el Hizb
        ۩    | # Sajda symbol
        ﭐ    | # Warsh-specific Alif
        ۝    | # Quranic symbol
        ً    | # Warsh-specific tanwin
        ٯ    | # Variant of Qaf (Warsh)
    """, re.VERBOSE)

    # Remove diacritics and Quranic symbols from the text
    normalized_text = re.sub(arabic_diacritics, '', text)

    # Remove Quranic verse numbers and other symbols (optional)
    normalized_text = re.sub(r'[۝۞۩]+', '', normalized_text)

    normalized_text = re.sub(r'أ|إ|آ|ٱ|ا۬|ا۪', 'ا', normalized_text)

    standard_arabic_characters = r'[^\u0621-\u063A\u0641-\u064A\s]'
    normalized_text = re.sub(standard_arabic_characters, '', normalized_text)
    normalized_text = normalized_text.strip()

    # global chars_to_normalize
    # # Use re.findall() to get all non-standard characters in the text
    # non_standard_chars = re.findall(standard_arabic_characters, normalized_text)
    # chars_to_normalize.update(non_standard_chars)

    return normalized_text


# Load the Quranic verses from the Excel file
# df_verses = pd.read_excel('Dataset-Verse-by-Verse.xlsx')
# if 'AyahKey' not in df_verses.columns:
#     df_verses['AyahKey'] = df_verses['SurahNo'].astype(str) + ":" + df_verses['AyahNo'].astype(str)
df_verses = pd.read_excel('warshData_v2-1-searchable.xlsx', dtype=str)
# id	jozz	page	sura_no	sura_name_en	sura_name_ar	line_start	line_end	aya_no	aya_text
if 'AyahKey' not in df_verses.columns:
    df_verses['AyahKey'] = df_verses['sura_no'].astype(str) + ":" + df_verses['aya_no'].astype(str)
if "searchable_text" not in df_verses.columns:
    df_verses["searchable_text"] = df_verses["aya_text"].apply(normalize_arabic_text)
    df_verses.to_excel(f'warshData_v2-1-searchable.xlsx', index=False)

    df = pd.DataFrame(chars_to_normalize, columns=['chars_to_normalize'])
    output_file = 'chars_to_normalize.xlsx'
    df.to_excel(output_file, index=False)

resources_directory = "./resources"

all_manuscripts = ["Konduga", "Muenster", "2ShK", "3ImI", "4MM", "Tahir Kano", "Kaduna-AR20", "Kaduna-AR33", "YM",
                   "Mutai", "BNF Arabe", "Gashi", "Zinder"]
annotations = {}
for m_id in all_manuscripts:
    if os.path.exists(os.path.join(resources_directory, f"{m_id}.xlsx")):
        annotations[m_id] = pd.read_excel(os.path.join(resources_directory, f"{m_id}.xlsx"), dtype={
            "annotation_id": str,
            "verse_id": str,
            "annotated_object": str,
            "annotation": str,
            "annotation_Language": str,
            "annotation_transliteration": str,
            "annotation_type": str,
            "other": str,
            "manuscript_id": str,
            "annotated_range": str,
            "flag": bool,
        })
        annotations[m_id] = annotations[m_id].replace('nan', '', regex=True)
        annotations[m_id] = annotations[m_id].fillna('')
        annotations[m_id]['manuscript_id'] = m_id
        if "annotation_id" not in annotations[m_id].columns:
            annotations[m_id].insert(0, 'annotation_id', range(0, len(annotations[m_id])))
        if "flag" not in annotations[m_id].columns:
            annotations[m_id]['flag'] = False

    else:
        annotations[m_id] = pd.DataFrame(columns=["annotation_id", "verse_id", "annotated_object", "annotation",
                                                  "annotation_Language", "annotation_transliteration",
                                                  "annotation_type", "other", "manuscript_id", "annotated_range", "flag"
                                                  ])
        annotations[m_id].to_excel(os.path.join(resources_directory, f'{m_id}.xlsx'), index=False)


def starts_with_arabic(text):
    arabic_pattern = re.compile(r'^[\u0600-\u06FF\u0750-\u077F]')
    return bool(arabic_pattern.match(text))


@app.route('/search_verse', methods=['GET'])
def search():
    query = request.args.get('query', '')
    if query[0].isdigit():
        verse_results = df_verses[df_verses['AyahKey'].str.startswith(query, na=False)].to_dict(orient='records')
    else:  # starts_with_arabic(query):
        verse_results = df_verses[df_verses['searchable_text'].str.contains(query, na=False)].to_dict(orient='records')
    # else:
    #     verse_results = df_verses[df_verses['EnglishTranslation'].str.contains(query, na=False)].to_dict(
    #         orient='records')

    results = verse_results

    return jsonify(results)


@app.route('/selectNextVerse', methods=['GET'])
def selectNextVerse():
    query = request.args.get('current', '')
    filtered_df = df_verses[df_verses['AyahKey'] == query]

    if filtered_df.empty or len(filtered_df) > 1:
        return jsonify(None)

    # Get the index of the first row where the condition is met
    target_index = filtered_df.index[0]

    # If it's the first row, return a message or None
    if target_index == len(df_verses) - 1:
        return jsonify(None)
    else:
        # Return the previous row
        results = df_verses.iloc[target_index + 1].to_dict()

    return jsonify(results)


@app.route('/selectPreviousVerse', methods=['GET'])
def selectPreviousVerse():
    query = request.args.get('current', '')
    filtered_df = df_verses[df_verses['AyahKey'] == query]

    if filtered_df.empty or len(filtered_df) > 1:
        return jsonify(None)

    # Get the index of the first row where the condition is met
    target_index = filtered_df.index[0]

    # If it's the first row, return a message or None
    if target_index == 0:
        return jsonify(None)
    else:
        # Return the previous row
        results = df_verses.iloc[target_index - 1].to_dict()

    return jsonify(results)


@app.route('/get_annotations', methods=['GET'])
def get_annotations():
    query = request.args.get('query', '')

    results = []
    for manuscript_id, annotations_list in annotations.items():
        annotations_list = annotations_list.to_dict(orient='records')
        manuscript_annotations = [a for a in annotations_list if a['verse_id'] == query]

        results.append({
            'manuscript_name': f"Manuscript {manuscript_id}",
            'manuscript_id': manuscript_id,
            'annotations': manuscript_annotations
        })

    return results


@app.route('/get_manuscripts', methods=['GET'])
def get_manuscripts():
    results = []
    for manuscript_id, _ in annotations.items():
        results.append({
            'manuscript_name': manuscript_id,
            'manuscript_id': manuscript_id,
        })

    return results


@app.route('/get_languages', methods=['GET'])
def get_languages():
    m = request.args.get("manuscript", "")
    results = []
    if m != "":
        results = annotations[m]['annotation_Language'].unique().tolist()
        # print(sorted(results))
    return results


@app.route('/get_annotation_types', methods=['GET'])
def get_annotation_types():
    m = request.args.get("manuscript", "")
    results = []
    if m != "":
        results = annotations[m]['annotation_type'].unique().tolist()
        # print(sorted(results))
    return results


@app.route('/save_annotation', methods=['POST'])
def save_annotation():
    try:
        data = request.json
        # Process the annotation data here
        # For example, save it to a database
        manus_id = data["manuscript_id"]
        data['annotation_id'] = f"{len(annotations[manus_id])}"
        df_dictionary = pd.DataFrame([data])
        annotations[manus_id] = pd.concat([annotations[manus_id], df_dictionary], ignore_index=True)
        annotations[manus_id].to_excel(os.path.join(resources_directory, f'{manus_id}.xlsx'), index=False)
        return jsonify({"message": "Annotation saved successfully"}), 200
    except Exception as e:
        return jsonify({"error": "An error occurred while saving the item"}), 500


@app.route('/delete_annotation', methods=['GET'])
def delete_annotation():
    a_id = request.args.get("a_id", "")
    m_id = request.args.get("m_id", "")
    try:
        annotations[m_id] = annotations[m_id][annotations[m_id]['annotation_id'] != a_id]
        annotations[m_id].to_excel(os.path.join(resources_directory, f'{m_id}.xlsx'), index=False)
        return jsonify({"message": "Item deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": "An error occurred while deleting the item"}), 500


@app.route('/update_annotation', methods=['POST'])
def update_annotation():
    try:
        data = request.json
        keys = []
        values = []
        for k, v in data.items():
            keys.append(k)
            values.append(v)
        manus_id = data["manuscript_id"]
        annotations[manus_id].loc[annotations[manus_id]['annotation_id'] == data['annotation_id'], keys] = values
        annotations[manus_id].to_excel(os.path.join(resources_directory, f'{manus_id}.xlsx'), index=False)
        return jsonify({"message": "Annotation saved successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"{e}"}), 500


@app.route('/save_annotations', methods=['POST'])
def save_annotations():
    updatedAndDeleted = request.json
    for data in updatedAndDeleted['updatedRows']:
        keys = []
        values = []
        for k, v in data.items():
            keys.append(k)
            values.append(v)
        manus_id = data["manuscript_id"]
        annotations[manus_id].loc[annotations[manus_id]['annotation_id'] == data['annotation_id'], keys] = values
        annotations[manus_id].to_excel(os.path.join(resources_directory, f'{manus_id}.xlsx'), index=False)

    for data in updatedAndDeleted['deletedRows']:
        a_id = data['annotation_id']
        m_id = data['manuscript_id']
        annotations[m_id] = annotations[m_id][annotations[m_id]['annotation_id'] != a_id]
        annotations[m_id].to_excel(os.path.join(resources_directory, f'{m_id}.xlsx'), index=False)

    return {'message': 'Annotations updated successfully'}, 200


@app.route('/filter_annotations', methods=['POST'])
def filter_annotations():
    filters = request.json
    filters_updated = filters.copy()
    for filter_key, filter in filters.items():
        if "value" in filter and filter['value'] == "" or "value" not in filter:
            del filters_updated[filter_key]

    filters = filters_updated
    if not filters:
        return jsonify({'error': 'No filters provided'}), 400

    # A list to hold the filtered annotations
    filtered_annotations = []

    for manuscript_id, annotations_list in annotations.items():
        # Convert the DataFrame of annotations to a list of dictionaries
        annotations_data = annotations_list.to_dict(orient='records')

        # Filter the annotations for this manuscript based on the provided filters
        for annotation in annotations_data:
            # Check each filter condition
            match = True
            for key, filter_data in filters.items():
                if key not in annotation:
                    match = False
                    break

                # Extract value and match type (optional)
                value = filter_data.get('value', '')
                match_type = filter_data.get('matchType', 'full')  # Default to 'partial'

                # Handle `flag` and `Id` filters (exact match only)
                if key in ['flag', 'annotation_id', 'manuscript_id', 'verse_id']:
                    # If `value` is a boolean or ID, perform exact match
                    if str(annotation[key]).lower() != str(value).lower():
                        match = False
                        break
                else:
                    # Handle string-based filters (full or partial match)
                    if isinstance(value, str) and value != "":
                        if match_type == 'full':
                            # Perform a full case-insensitive match
                            if str(annotation[key]).lower() != str(value).lower():
                                match = False
                                break
                        elif match_type == 'partial':
                            # Perform a partial case-insensitive match
                            if str(value).lower() not in str(annotation[key]).lower():
                                match = False
                                break

            # Add to the filtered list if all conditions match
            if match:
                filtered_annotations.append(annotation)

    return jsonify(filtered_annotations)



    # # Get the filter criteria from the request body
    # filters = request.json
    #
    # if not filters:
    #     return jsonify({'error': 'No filters provided'}), 400
    #
    # filtered_results = []
    # for manuscript_id, annotations_list in annotations.items():
    #     annotations_list = annotations_list.to_dict(orient='records')  # Convert DataFrame to list of dicts
    #     manuscript_filtered = annotations_list
    #
    #     # Apply each filter condition dynamically
    #     for key, value in filters.items():
    #         if value is not None and value != '':
    #             if key == 'flag':  # Special handling for boolean values
    #                 manuscript_filtered = [a for a in manuscript_filtered if a.get(key) == (value is True or value == 'true')]
    #             else:
    #                 manuscript_filtered = [a for a in manuscript_filtered if str(a.get(key, '')).lower() == str(value).lower()]
    #
    #     # Add the filtered annotations for the current manuscript
    #     if manuscript_filtered:
    #         filtered_results.append({
    #             'manuscript_name': f"Manuscript {manuscript_id}",
    #             'manuscript_id': manuscript_id,
    #             'annotations': manuscript_filtered
    #         })
    #
    # return jsonify(filtered_results)
# Add these functions to your existing Flask server code

# Global dictionary to store templates in memory
saved_templates = {}

def load_saved_templates():
    """Load all saved templates from Excel files into memory"""
    global saved_templates
    for manuscript_id in all_manuscripts:
        template_file = os.path.join(resources_directory, f"{manuscript_id}_saved_templates.xlsx")
        if os.path.exists(template_file):
            try:
                saved_templates[manuscript_id] = pd.read_excel(template_file, dtype={
                    "template_id": str,
                    "annotation": str,
                    "annotation_Language": str,
                    "annotation_transliteration": str,
                    "annotation_type": str,
                    "other": str,
                    "created_date": str
                })
                saved_templates[manuscript_id] = saved_templates[manuscript_id].fillna('')
            except Exception as e:
                print(f"Error loading templates for {manuscript_id}: {e}")
                saved_templates[manuscript_id] = pd.DataFrame(columns=[
                    "template_id", "annotation", "annotation_Language",
                    "annotation_transliteration", "annotation_type", "other", "created_date"
                ])
        else:
            # Create empty template DataFrame
            saved_templates[manuscript_id] = pd.DataFrame(columns=[
                "template_id", "annotation", "annotation_Language",
                "annotation_transliteration", "annotation_type", "other", "created_date"
            ])

# Load templates when server starts
load_saved_templates()

@app.route('/get_attribute_suggestions', methods=['GET'])
def get_attribute_suggestions():
    manuscript_id = request.args.get('manuscript', '')
    field = request.args.get('field', '')
    query = request.args.get('query', '')

    if not manuscript_id or not field or not query:
        return jsonify([])

    if manuscript_id not in annotations:
        return jsonify([])

    try:
        # Get all unique values for the specified field from the manuscript
        field_values = annotations[manuscript_id][field].dropna().astype(str)
        field_values = field_values[field_values != ''].unique()

        # Filter values that contain the query (case-insensitive)
        suggestions = [
            value for value in field_values
            if query.lower() in value.lower()
        ]

        # Sort by relevance (exact matches first, then starts with, then contains)
        def sort_key(item):
            item_lower = item.lower()
            query_lower = query.lower()
            if item_lower == query_lower:
                return (0, item)  # Exact match
            elif item_lower.startswith(query_lower):
                return (1, item)  # Starts with
            else:
                return (2, item)  # Contains

        suggestions.sort(key=sort_key)

        # Limit to top 10 suggestions
        return jsonify(suggestions[:10])

    except Exception as e:
        print(f"Error in get_attribute_suggestions: {e}")
        return jsonify([])


@app.route('/get_template_suggestions', methods=['GET'])
def get_template_suggestions():
    manuscript_id = request.args.get('manuscript', '')
    query = request.args.get('query', '')

    if not manuscript_id or not query:
        return jsonify([])

    if manuscript_id not in saved_templates:
        return jsonify([])

    try:
        # Template fields
        template_fields = ['annotation', 'annotation_Language', 'annotation_transliteration', 'annotation_type', 'other']

        # Get saved templates for the manuscript
        templates_data = saved_templates[manuscript_id]

        if templates_data.empty:
            return jsonify([])

        # Create template suggestions
        suggestions = []
        for _, row in templates_data.iterrows():
            # Create display text in format: "annotation-language-transliteration-type-other"
            display_parts = []
            for field in template_fields:
                value = str(row[field]).strip() if pd.notna(row[field]) else ''
                if value and value != 'nan':
                    # Truncate long values for display
                    if len(value) > 20:
                        value = value[:17] + "..."
                    display_parts.append(value)
                else:
                    display_parts.append('')

            display_text = '-'.join(display_parts)

            # Check if query matches any part of the display text (case-insensitive)
            if query.lower() in display_text.lower():
                template = {
                    'id': str(row.get('template_id', len(suggestions))),
                    'annotation': str(row['annotation']) if pd.notna(row['annotation']) else '',
                    'annotation_Language': str(row['annotation_Language']) if pd.notna(row['annotation_Language']) else '',
                    'annotation_transliteration': str(row['annotation_transliteration']) if pd.notna(row['annotation_transliteration']) else '',
                    'annotation_type': str(row['annotation_type']) if pd.notna(row['annotation_type']) else '',
                    'other': str(row['other']) if pd.notna(row['other']) else '',
                    'displayText': display_text
                }
                suggestions.append(template)

        # Remove duplicates based on the combination of all template fields
        seen_combinations = set()
        unique_suggestions = []

        for suggestion in suggestions:
            combination = (
                suggestion['annotation'],
                suggestion['annotation_Language'],
                suggestion['annotation_transliteration'],
                suggestion['annotation_type'],
                suggestion['other']
            )
            if combination not in seen_combinations:
                seen_combinations.add(combination)
                unique_suggestions.append(suggestion)

        # Sort by relevance (better matches first)
        def sort_key(item):
            display_lower = item['displayText'].lower()
            query_lower = query.lower()
            if query_lower in display_lower:
                # Prioritize matches at the beginning
                index = display_lower.find(query_lower)
                return (index, item['displayText'])
            return (999, item['displayText'])

        unique_suggestions.sort(key=sort_key)

        # Limit to top 8 suggestions to avoid overwhelming the UI
        return jsonify(unique_suggestions[:8])

    except Exception as e:
        print(f"Error in get_template_suggestions: {e}")
        return jsonify([])


@app.route('/save_template', methods=['POST'])
def save_template():
    try:
        data = request.json
        manuscript_id = data.get('manuscript_id', '')

        if not manuscript_id:
            return jsonify({"error": "Manuscript ID is required"}), 400

        if manuscript_id not in all_manuscripts:
            return jsonify({"error": "Invalid manuscript ID"}), 400

        # Template fields to save
        template_fields = ['annotation', 'annotation_Language', 'annotation_transliteration', 'annotation_type', 'other']

        # Validate that at least one field has content
        has_content = any(data.get(field, '').strip() for field in template_fields)
        if not has_content:
            return jsonify({"error": "Template must have at least one non-empty field"}), 400

        # Initialize templates for manuscript if not exists
        if manuscript_id not in saved_templates:
            saved_templates[manuscript_id] = pd.DataFrame(columns=[
                "template_id", "annotation", "annotation_Language",
                "annotation_transliteration", "annotation_type", "other", "created_date"
            ])

        # Check if this exact template combination already exists
        templates_data = saved_templates[manuscript_id]

        if not templates_data.empty:
            # Create a mask to find matching templates
            match_conditions = []
            for field in template_fields:
                field_value = data.get(field, '').strip()
                if field_value:
                    match_conditions.append(templates_data[field].fillna('').astype(str).str.strip() == field_value)
                else:
                    match_conditions.append(templates_data[field].fillna('').astype(str).str.strip() == '')

            # Combine all conditions with AND
            if match_conditions:
                combined_mask = match_conditions[0]
                for condition in match_conditions[1:]:
                    combined_mask = combined_mask & condition

                # Check if any row matches all conditions
                if combined_mask.any():
                    return jsonify({"message": "Template already exists"}), 200

        # Create new template entry
        from datetime import datetime
        template_data = {
            'template_id': f"tmpl_{len(saved_templates[manuscript_id])}_{int(datetime.now().timestamp())}",
            'annotation': data.get('annotation', '').strip(),
            'annotation_Language': data.get('annotation_Language', '').strip(),
            'annotation_transliteration': data.get('annotation_transliteration', '').strip(),
            'annotation_type': data.get('annotation_type', '').strip(),
            'other': data.get('other', '').strip(),
            'created_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        # Add template to saved_templates
        df_template = pd.DataFrame([template_data])
        saved_templates[manuscript_id] = pd.concat([saved_templates[manuscript_id], df_template], ignore_index=True)

        # Save to separate Excel file for templates
        template_file = os.path.join(resources_directory, f"{manuscript_id}_saved_templates.xlsx")
        saved_templates[manuscript_id].to_excel(template_file, index=False)

        return jsonify({"message": "Template saved successfully"}), 200

    except Exception as e:
        print(f"Error in save_template: {e}")
        return jsonify({"error": "An error occurred while saving the template"}), 500

if __name__ == '__main__':
    app.run(debug=True)
