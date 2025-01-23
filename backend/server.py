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


if __name__ == '__main__':
    app.run(debug=True)
