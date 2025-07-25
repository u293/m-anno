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
saved_templates = pd.DataFrame()

def load_saved_templates():
    """Load all saved templates from a single Excel file into memory"""
    global saved_templates
    template_file = os.path.join(resources_directory, "saved_templates.xlsx")
    if os.path.exists(template_file):
        try:
            saved_templates = pd.read_excel(template_file, dtype={
                "template_id": str,
                "template_name": str,
                "manuscript_id": str,
                "annotation": str,
                "annotation_Language": str,
                "annotation_transliteration": str,
                "annotation_type": str,
                "other": str,
                "created_date": str,
                "popularity": int
            })
            saved_templates = saved_templates.fillna('')
            # Ensure popularity column exists and has default values
            if 'popularity' not in saved_templates.columns:
                saved_templates['popularity'] = 1
            else:
                # Convert popularity to int and handle NaN values
                saved_templates['popularity'] = saved_templates['popularity'].fillna(1).astype(int)
        except Exception as e:
            print(f"Error loading templates: {e}")
            saved_templates = pd.DataFrame(columns=[
                "template_id", "template_name", "manuscript_id", "annotation", "annotation_Language",
                "annotation_transliteration", "annotation_type", "other", "created_date", "popularity"
            ])
    else:
        # Create empty template DataFrame
        saved_templates = pd.DataFrame(columns=[
            "template_id", "template_name", "manuscript_id", "annotation", "annotation_Language",
            "annotation_transliteration", "annotation_type", "other", "created_date", "popularity"
        ])

# Load templates when server starts
load_saved_templates()

@app.route('/increment_template_popularity', methods=['POST'])
def increment_template_popularity():
    """Increment the popularity counter for a specific template"""
    global saved_templates
    try:
        data = request.json
        template_id = data.get('template_id', '').strip()

        if not template_id:
            return jsonify({"error": "Template ID is required"}), 400

        # Find the template by ID
        template_mask = saved_templates['template_id'] == template_id

        if not template_mask.any():
            return jsonify({"error": "Template not found"}), 404

        # Increment popularity
        saved_templates.loc[template_mask, 'popularity'] = saved_templates.loc[template_mask, 'popularity'] + 1

        # Save the updated templates to Excel file
        template_file = os.path.join(resources_directory, "saved_templates.xlsx")
        saved_templates.to_excel(template_file, index=False)

        # Get the updated popularity value for confirmation
        updated_popularity = saved_templates.loc[template_mask, 'popularity'].iloc[0]

        return jsonify({
            "message": "Template popularity incremented successfully",
            "template_id": template_id,
            "new_popularity": int(updated_popularity)
        }), 200

    except Exception as e:
        print(f"Error in increment_template_popularity: {e}")
        return jsonify({"error": "An error occurred while incrementing template popularity"}), 500

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
    recent = request.args.get('recent', '')

    try:
        # Template fields
        template_fields = ['annotation', 'annotation_Language', 'annotation_transliteration', 'annotation_type', 'other']

        # Get all saved templates (global across all manuscripts)
        if saved_templates.empty:
            return jsonify([])

        # Handle recent parameter - when true, sort by popularity and ignore query
        if recent.lower() == 'true':
            # Sort by popularity column (highest first)
            if 'popularity' not in saved_templates.columns:
                print("Warning: 'popularity' column not found in saved_templates")
                return jsonify([])

            # Sort by popularity descending (highest popularity first)
            sorted_templates = saved_templates.sort_values('popularity', ascending=False)

            # Create suggestions from sorted templates
            suggestions = []
            for _, row in sorted_templates.iterrows():
                # Use template_name if available, otherwise create display text from fields
                if row.get('template_name') and str(row['template_name']).strip():
                    display_text = str(row['template_name']).strip()
                else:
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
                    display_text = '-'.join(filter(None, display_parts))  # Filter out empty parts

                template = {
                    'id': str(row.get('template_id', len(suggestions))),
                    'annotation': str(row['annotation']) if pd.notna(row['annotation']) else '',
                    'annotation_Language': str(row['annotation_Language']) if pd.notna(row['annotation_Language']) else '',
                    'annotation_transliteration': str(row['annotation_transliteration']) if pd.notna(row['annotation_transliteration']) else '',
                    'annotation_type': str(row['annotation_type']) if pd.notna(row['annotation_type']) else '',
                    'other': str(row['other']) if pd.notna(row['other']) else '',
                    'displayText': display_text,
                    'popularity': int(row['popularity']) if pd.notna(row['popularity']) else 0
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

            # Return top 10 most recent suggestions
            return jsonify(unique_suggestions[:10])

        # Original query-based logic when recent is not true
        if not query:
            return jsonify([])

        # Create template suggestions based on query
        suggestions = []
        for _, row in saved_templates.iterrows():
            # Use template_name if available, otherwise create display text from fields
            if row.get('template_name') and str(row['template_name']).strip():
                display_text = str(row['template_name']).strip()
            else:
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
                display_text = '-'.join(filter(None, display_parts))  # Filter out empty parts

            # Check if query matches any part of the display text or template fields (case-insensitive)
            searchable_text = display_text.lower()
            field_text = ' '.join([
                str(row[field]).lower() if pd.notna(row[field]) else ''
                for field in template_fields
            ])

            if query.lower() in searchable_text or query.lower() in field_text:
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
    global saved_templates
    try:
        data = request.json
        manuscript_id = data.get('manuscript_id', '')
        template_name = data.get('template_name', '').strip()
        template_id = data.get('id', '').strip()

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

        # Check if this exact template combination already exists
        if not saved_templates.empty:
            # Create a mask to find matching templates
            match_conditions = []
            for field in template_fields:
                field_value = data.get(field, '').strip()
                if field_value:
                    match_conditions.append(saved_templates[field].fillna('').astype(str).str.strip() == field_value)
                else:
                    match_conditions.append(saved_templates[field].fillna('').astype(str).str.strip() == '')

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
            'template_id': template_id,
            'template_name': template_name,
            'manuscript_id': manuscript_id,
            'annotation': data.get('annotation', '').strip(),
            'annotation_Language': data.get('annotation_Language', '').strip(),
            'annotation_transliteration': data.get('annotation_transliteration', '').strip(),
            'annotation_type': data.get('annotation_type', '').strip(),
            'other': data.get('other', '').strip(),
            'created_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'popularity': 1
        }

        # Add template to saved_templates
        df_template = pd.DataFrame([template_data])
        saved_templates = pd.concat([saved_templates, df_template], ignore_index=True)

        # Save to single Excel file for all templates
        template_file = os.path.join(resources_directory, "saved_templates.xlsx")
        saved_templates.to_excel(template_file, index=False)

        return jsonify({"message": "Template saved successfully"}), 200

    except Exception as e:
        print(f"Error in save_template: {e}")
        return jsonify({"error": "An error occurred while saving the template"}), 500

@app.route('/get_next_template_id', methods=['GET'])
def get_next_template_id():
    global saved_templates
    try:
        if saved_templates.empty or 'template_id' not in saved_templates.columns:
            next_id = 1
        else:
            # Extract numerical parts from existing template_ids
            # Assuming template_ids are like "temp_1", "temp_2", or just "1", "2"
            numeric_ids = []
            for tid in saved_templates['template_id'].dropna().astype(str):
                # Try to extract numbers, handling cases like "temp_123" or just "123"
                try:
                    # If it's purely numeric
                    numeric_ids.append(int(tid))
                except ValueError:
                    # If it has a prefix like "temp_"
                    if '_' in tid:
                        try:
                            numeric_ids.append(int(tid.split('_')[-1]))
                        except ValueError:
                            pass # Ignore if not a valid number after split

            if numeric_ids:
                next_id = max(numeric_ids) + 1
            else:
                next_id = 1

        # You can format the ID as needed, e.g., "temp_1", "temp_2"
        # For simplicity, returning just the number as a string for now,
        # but you can add a prefix if your client expects it.
        return jsonify({"nextId": str(next_id)}), 200

    except Exception as e:
        print(f"Error in get_next_template_id: {e}")
        return jsonify({"error": "An error occurred while generating the next template ID"}), 500


@app.route('/get_template', methods=['GET'])
def get_template():
    global saved_templates # Ensure access to the global DataFrame
    template_id = request.args.get('id')

    if not template_id:
        return jsonify({"error": "Template ID is required"}), 400

    try:
        # Ensure 'template_id' column is treated as string for robust comparison
        # And handle potential NaN values by converting to string first
        template_row = saved_templates[saved_templates['template_id'].fillna('').astype(str) == template_id]

        if not template_row.empty:
            # Convert the found row to a dictionary and return.
            # .iloc[0] gets the first (and should be only) matching row
            # .to_dict() converts it to a dictionary
            # orient='records' ensures it's a list of dictionaries if multiple rows matched,
            # but with template_id as unique, it will be a list with one dict.
            # We take the first element [0]
            template_data = template_row.iloc[0].to_dict()

            # Clean up the data for the frontend if necessary (e.g., remove popularity, created_date)
            # Or send all, depending on what your frontend 'Template' interface expects.
            # Let's match your frontend 'Template' interface.
            response_data = {
                "id": template_data.get('template_id', ''),
                "annotation": template_data.get('annotation', ''),
                "annotation_Language": template_data.get('annotation_Language', ''),
                "annotation_transliteration": template_data.get('annotation_transliteration', ''),
                "annotation_type": template_data.get('annotation_type', ''),
                "other": template_data.get('other', ''),
                "displayText": template_data.get('template_name', ''), # Assuming template_name can be used for displayText
                "template_name": template_data.get('template_name', '')
            }

            return jsonify(response_data), 200
        else:
            return jsonify({"message": "Template not found"}), 404

    except Exception as e:
        print(f"Error in get_template: {e}")
        return jsonify({"error": "An error occurred while fetching the template"}), 500

if __name__ == '__main__':
    app.run(debug=True)
