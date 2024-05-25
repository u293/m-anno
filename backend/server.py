from flask import Flask, request, jsonify
import pandas as pd
from flask_cors import CORS
import json
import os
import re

app = Flask(__name__)
CORS(app)

# Load the Quranic verses from the Excel file
df_verses = pd.read_excel('Dataset-Verse-by-Verse.xlsx')

# Load annotations from the CSV files
annotations = {}
for i in range(1, 14):
    csv_file = f'annotations_{i}.csv'
    if os.path.exists(csv_file):
        annotations[i] = pd.read_csv(csv_file).to_dict(orient='records')

def starts_with_arabic(text):
    arabic_pattern = re.compile(r'^[\u0600-\u06FF\u0750-\u077F]')
    return bool(arabic_pattern.match(text))

@app.route('/search_verse', methods=['GET'])
def search():
    query = request.args.get('query', '')
    if query[0].isdigit():
        verse_results = df_verses[df_verses['AyahKey'].str.startswith(query, na=False)].to_dict(orient='records')
    elif starts_with_arabic(query):
        verse_results = df_verses[df_verses['ArabicText'].str.contains(query, na=False)].to_dict(orient='records')
    else:
        verse_results = df_verses[df_verses['EnglishTranslation'].str.contains(query, na=False)].to_dict(orient='records')

    results = verse_results

    return jsonify(results)

@app.route('/get_annotations', methods=['GET'])
def get_annotations():
    query = request.args.get('query', '')

    results = []
    for manuscript_id, annotations_list in annotations.items():
        manuscript_annotations = [a for a in annotations_list if a['verse_id'] == query]
        results.append({
            'manuscript_name': f"Manuscript_{manuscript_id}",
            'manuscript_id': manuscript_id,
            'annotations': manuscript_annotations
        })

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)
