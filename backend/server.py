from flask import Flask, request, jsonify
import pandas as pd
from flask_cors import CORS
import numpy as np
import json
import os
import re

app = Flask(__name__)
CORS(app)

# Load the Quranic verses from the Excel file
# df_verses = pd.read_excel('Dataset-Verse-by-Verse.xlsx')
# if 'AyahKey' not in df_verses.columns:
#     df_verses['AyahKey'] = df_verses['SurahNo'].astype(str) + ":" + df_verses['AyahNo'].astype(str)
df_verses = pd.read_excel('warshData_v2-1.xlsx', dtype=str)
#id	jozz	page	sura_no	sura_name_en	sura_name_ar	line_start	line_end	aya_no	aya_text
if 'AyahKey' not in df_verses.columns:
    df_verses['AyahKey'] = df_verses['sura_no'].astype(str) + ":" + df_verses['aya_no'].astype(str)

# Load annotations from the CSV files
# manus_id_name_mapper = {0: "Konduga"}

annotations = {}
annotations["Konduga"] = pd.read_excel("Dataset-Verse-by-Verse1-Konduga.xlsx").astype(str)
annotations["Konduga"] = annotations["Konduga"].replace('nan','',regex=True)
if "annotation_id" not in annotations["Konduga"].columns:
    annotations["Konduga"].insert(0, 'annotation_id', range(0, len(annotations["Konduga"])))
annotations["Konduga"] = annotations["Konduga"].rename(columns={"annotation_aya": "verse_id",
                                                                "annotation_Konduga": "annotation",
                                                                "annotation_transliteration": "annotation_transliteration",
                                                                })
# print(annotations[0].columns)

# print(annotations["Konduga"])


# for i in range(1, 2):
#     csv_file = f'annotations_{i}.csv'
#     if os.path.exists(csv_file):
#         annotations[i] = pd.read_csv(csv_file).to_dict(orient='records')

def starts_with_arabic(text):
    arabic_pattern = re.compile(r'^[\u0600-\u06FF\u0750-\u077F]')
    return bool(arabic_pattern.match(text))


@app.route('/search_verse', methods=['GET'])
def search():
    query = request.args.get('query', '')
    if query[0].isdigit():
        verse_results = df_verses[df_verses['AyahKey'].str.startswith(query, na=False)].to_dict(orient='records')
    else:# starts_with_arabic(query):
        verse_results = df_verses[df_verses['aya_text'].str.contains(query, na=False)].to_dict(orient='records')
    # else:
    #     verse_results = df_verses[df_verses['EnglishTranslation'].str.contains(query, na=False)].to_dict(
    #         orient='records')

    results = verse_results

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


@app.route('/save-annotation', methods=['POST'])
def save_annotation():
    data = request.json
    # Process the annotation data here
    # For example, save it to a database
    manus_id = data["manuscript_id"]
    data['annotation_id'] = f"{len(annotations[manus_id])}"
    df_dictionary = pd.DataFrame([data])
    annotations[manus_id] = pd.concat([annotations[manus_id], df_dictionary], ignore_index=True)
    annotations[manus_id].to_excel('Dataset-Verse-by-Verse1-Konduga.xlsx', index=False)
    return jsonify({"message": "Annotation saved successfully"}), 200


if __name__ == '__main__':
    app.run(debug=True)
