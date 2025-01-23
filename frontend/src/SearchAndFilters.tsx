import React, { useState } from 'react';
import axios from 'axios';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { HotTable } from '@handsontable/react-wrapper';
import { Annotation } from "./types";
import Handsontable from 'handsontable/base';
import { registerAllModules } from 'handsontable/registry';
import './App.css';

registerAllModules();

const SearchAndFilters: React.FC = () => {
    const [filters, setFilters] = useState<{
        [key: string]: { value: string; matchType: 'full' | 'partial' } | string | boolean | undefined;
    }>({
        annotation: { value: '', matchType: 'full' },
        annotated_object: { value: '', matchType: 'full' },
        annotation_type: { value: '', matchType: 'full' },
        annotation_Language: { value: '', matchType: 'full' },
        annotation_transliteration: { value: '', matchType: 'full' },
        other: { value: '', matchType: 'full' },
        annotation_id: '',
        annotation_range: '',
        manuscript_id: '',
        verse_id: '',
        flag: undefined,
    });
    const [results, setResults] = useState<Annotation[]>([]);
    const [modifiedData, setModifiedData] = useState<Annotation[]>([]);
    const [updatedCells, setUpdatedCells] = useState<Set<string>>(new Set());
    const [hasSearched, setHasSearched] = useState<boolean>(false);
    const [saveEnabled, setSaveEnabled] = useState<boolean>(false);
    const [deletedRows, setDeletedRows] = useState<Set<number>>(new Set()); // Track deleted rows

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // Check if the field is a radio button or a text input
        if (name.endsWith('_matchType')) {
            // Update matchType for the associated filter
            const filterName = name.replace('_matchType', '');
            setFilters((prevFilters) => ({
                ...prevFilters,
                [filterName]: {
                    ...(prevFilters[filterName] as { value: string; matchType: 'full' | 'partial' }),
                    matchType: value as 'full' | 'partial',
                },
            }));
        } else {
            // Update value for string-based or simple filters
            setFilters((prevFilters) => {
                if (name in prevFilters && typeof prevFilters[name] === 'object') {
                    // Update the value of a string-based filter
                    return {
                        ...prevFilters,
                        [name]: {
                            ...(prevFilters[name] as { value: string; matchType: 'full' | 'partial' }),
                            value: value,
                        },
                    };
                } else {
                    // Update simple filters (e.g., IDs or flag)
                    return {
                        ...prevFilters,
                        [name]: name === 'flag' && value === ''
                            ? undefined
                            : name === 'flag'
                                ? value === 'true'
                                : value,
                    };
                }
            });
        }
    };


    const fetchFilteredResults = async () => {
        if (saveEnabled) {
            const proceed = window.confirm(
                "You have unsaved changes. Applying new filters will discard these changes. Do you want to continue?"
            );
            if (!proceed) {
                return; // Abort filter application if the user cancels
            }
        }

        const payload = Object.entries(filters).reduce((acc, [key, filter]) => {
            if (typeof filter === 'object' && filter !== null) {
                // Handle string-based filters with matchType
                acc[key] = { value: filter.value, matchType: filter.matchType || 'partial' };
            } else {
                // Handle ID and boolean filters
                acc[key] = { value: filter };
            }
            return acc;
        }, {} as Record<string, any>);

        try {
            const response = await axios.post<Annotation[]>('http://localhost:5000/filter_annotations', payload);
            setResults(response.data);
            setModifiedData([]); // Reset modified data
            setUpdatedCells(new Set()); // Clear updated cell tracking
            setDeletedRows(new Set()); // Clear deleted rows tracking
            setHasSearched(true);
            setSaveEnabled(false); // Disable save button since changes are discarded
        } catch (error) {
            alert('Error fetching annotations: ' + error);
        }
    };


    const handleTableChange = (changes: Handsontable.CellChange[] | null) => {
        if (changes) {
            const updatedResults = [...results];
            const updatedSet = new Set(updatedCells);

            changes.forEach(([row, col, oldValue, newValue]) => {
                if (col && typeof col === 'string' && col in updatedResults[row]) {
                    (updatedResults[row] as Record<string, any>)[col] = newValue;

                    // Track updated cells using row and column identifiers
                    updatedSet.add(`${row}-${col}`);
                }
            });

            setModifiedData(updatedResults);
            setUpdatedCells(updatedSet);
            setSaveEnabled(true); // Enable save button
        }
    };

    const markForDeletion = (row: number) => {
        const newDeletedRows = new Set(deletedRows);
        if (newDeletedRows.has(row)) {
            newDeletedRows.delete(row); // Unmark for deletion
        } else {
            newDeletedRows.add(row); // Mark for deletion
        }
        setDeletedRows(newDeletedRows);

        setSaveEnabled(true);
    };

    const saveChanges = async () => {
        if (saveEnabled) {
            if (window.confirm("Changes may affect several rows. Do you want to proceed?")) {
                // Get the rows that were updated
                const updatedRows = results.filter((_, rowIndex) =>
                    Array.from(updatedCells).some((cell) => cell.startsWith(`${rowIndex}-`))
                );

                // Get the rows that were marked for deletion
                const deletedRowsArray = Array.from(deletedRows).map((rowIndex) => results[rowIndex]);

                console.log("Updated Rows: ", updatedRows);
                console.log("Deleted Rows: ", deletedRowsArray);

                try {
                    // Send the updated and deleted data to the backend
                    await axios.post('http://localhost:5000/save_annotations', {
                        updatedRows,
                        deletedRows: deletedRowsArray,
                    });

                    // Remove the deleted rows from the table after successful save
                    const remainingRows = results.filter((_, index) => !deletedRows.has(index));
                    setResults(remainingRows);

                    // Clear state after saving
                    setSaveEnabled(false);
                    setDeletedRows(new Set());
                    setUpdatedCells(new Set());
                    alert('Changes saved successfully!');
                } catch (error) {
                    alert('Error saving annotations: ' + error);
                }
            }
        }
    };


    return (
        <div className="container mt-5">
            <h1>Search and Filters</h1>
            <form className="mb-4">
                <div className="row">
                    <div className="col-md-4">
                        {/* Filters Column 1 */}
                        <div className="form-group filterbox">
                            <label htmlFor="annotation_id">Annotation ID</label>
                            <input
                                type="text"
                                name="annotation_id"
                                value={(filters.annotation_id as string) || ''}
                                onChange={handleInputChange}
                                className="form-control form-control-sm"
                            />
                        </div>
                        <div className="form-group filterbox">
                            <label htmlFor="manuscript_id">Manuscript ID</label>
                            <input
                                type="text"
                                name="manuscript_id"
                                value={(filters.manuscript_id as string) || ''}
                                onChange={handleInputChange}
                                className="form-control form-control-sm"
                            />
                        </div>
                        <div className="form-group filterbox">
                            <label htmlFor="verse_id">Verse ID</label>
                            <input
                                type="text"
                                name="verse_id"
                                value={(filters.verse_id as string)|| ''}
                                onChange={handleInputChange}
                                className="form-control form-control-sm"
                            />
                        </div>
                        <div className="form-group filterbox">
                            <label htmlFor="annotated_object">Annotated Object</label>
                            <input
                                type="text"
                                name="annotated_object"
                                value={(filters.annotated_object as { value: string })?.value || ''}
                                onChange={handleInputChange}
                                className="form-control form-control-sm"
                            />
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="annotated_object_matchType"
                                    value="partial"
                                    checked={(filters.annotated_object as { matchType: string })?.matchType === 'partial'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Partial Match</label>
                            </div>
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="annotated_object_matchType"
                                    value="full"
                                    checked={(filters.annotated_object as { matchType: string })?.matchType === 'full'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Full Match</label>
                            </div>
                        </div>

                    </div>
                    <div className="col-md-4">
                        {/* Filters Column 2 */}
                        <div className="form-group filterbox">
                            <label htmlFor="annotation">Annotation</label>
                            <input
                                type="text"
                                name="annotation"
                                value={(filters.annotation as { value: string })?.value || ''}
                                onChange={handleInputChange}
                                className="form-control form-control-sm"
                            />
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="annotation_matchType"
                                    value="partial"
                                    checked={(filters.annotation as { matchType: string })?.matchType === 'partial'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Partial Match</label>
                            </div>
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="annotation_matchType"
                                    value="full"
                                    checked={(filters.annotation as { matchType: string })?.matchType === 'full'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Full Match</label>
                            </div>
                        </div>
                        <div className="form-group filterbox">
                            <label htmlFor="annotation_type">Annotated Type</label>
                            <input
                                type="text"
                                name="annotation_type"
                                value={(filters.annotation_type as { value: string })?.value || ''}
                                onChange={handleInputChange}
                                className="form-control form-control-sm"
                            />
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="annotation_type_matchType"
                                    value="partial"
                                    checked={(filters.annotation_type as {
                                        matchType: string
                                    })?.matchType === 'partial'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Partial Match</label>
                            </div>
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="annotation_type_matchType"
                                    value="full"
                                    checked={(filters.annotation_type as { matchType: string })?.matchType === 'full'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Full Match</label>
                            </div>
                        </div>

                        <div className="form-group filterbox">
                            <label htmlFor="flag">Flag</label>
                            <select
                                name="flag"
                                value={filters.flag === true ? 'true' : filters.flag === false ? 'false' : ''}
                                onChange={handleInputChange}
                                className="form-control form-control-sm"
                            >
                                <option value="">All</option>
                                <option value="true">True</option>
                                <option value="false">False</option>
                            </select>
                        </div>
                    </div>
                    <div className="col-md-4">
                        {/* Filters Column 3 */}
                        <div className="form-group filterbox">
                            <label htmlFor="annotated_range">Annotated Range</label>
                            <input
                                type="text"
                                name="annotated_range"
                                value={(filters.annotated_range as string) || ''}
                                onChange={handleInputChange}
                                className="form-control form-control-sm"
                            />
                        </div>

                        <div className="form-group filterbox">
                            <label htmlFor="annotation_Language">Annotated Language</label>
                            <input
                                type="text"
                                name="annotation_Language"
                                value={(filters.annotation_Language as { value: string })?.value || ''}
                                onChange={handleInputChange}
                                className="form-control form-control-sm"
                            />
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="annotation_Language_matchType"
                                    value="partial"
                                    checked={(filters.annotation_Language as {
                                        matchType: string
                                    })?.matchType === 'partial'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Partial Match</label>
                            </div>
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="annotation_Language_matchType"
                                    value="full"
                                    checked={(filters.annotation_Language as {
                                        matchType: string
                                    })?.matchType === 'full'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Full Match</label>
                            </div>
                        </div>


                        <div className="form-group filterbox">
                            <label htmlFor="annotation_transliteration">Annotation Transliteration</label>
                            <input
                                type="text"
                                name="annotation_transliteration"
                                value={(filters.annotation_transliteration as { value: string })?.value || ''}
                                onChange={handleInputChange}
                                className="form-control form-control-sm"
                            />
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="annotation_transliteration_matchType"
                                    value="partial"
                                    checked={(filters.annotation_transliteration as {
                                        matchType: string
                                    })?.matchType === 'partial'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Partial Match</label>
                            </div>
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="annotation_transliteration_matchType"
                                    value="full"
                                    checked={(filters.annotation_transliteration as {
                                        matchType: string
                                    })?.matchType === 'full'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Full Match</label>
                            </div>
                        </div>


                        <div className="form-group filterbox">
                            <label htmlFor="other">Other Notes</label>
                            <input
                                type="text"
                                name="other"
                                value={(filters.other as { value: string })?.value || ''}
                                onChange={handleInputChange}
                                className="form-control form-control-sm"
                            />
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="other_matchType"
                                    value="partial"
                                    checked={(filters.other as {
                                        matchType: string
                                    })?.matchType === 'partial'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Partial Match</label>
                            </div>
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="other_matchType"
                                    value="full"
                                    checked={(filters.other as {
                                        matchType: string
                                    })?.matchType === 'full'}
                                    onChange={handleInputChange}
                                />
                                <label className="form-check-label">Full Match</label>
                            </div>
                        </div>


                    </div>
                </div>
            </form>

            <div>
                <button className="btn btn-primary me-2 btn-sm" onClick={fetchFilteredResults}>
                    Apply Filters
                </button>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                        setFilters({
                            annotation: { value: '', matchType: 'full' },
                            annotated_object: { value: '', matchType: 'full' },
                            annotation_type: { value: '', matchType: 'full' },
                            annotation_Language: { value: '', matchType: 'full' },
                            annotation_transliteration: { value: '', matchType: 'full' },
                            other: { value: '', matchType: 'full' },
                            annotation_id: '',
                            annotation_range: '',
                            manuscript_id: '',
                            verse_id: '',
                            flag: undefined,
                        });

                        setResults([]);
                        setHasSearched(false);
                        setUpdatedCells(new Set());
                        setSaveEnabled(false);
                    }}
                >
                    Reset Filters
                </button>
            </div>

            <div className="mt-4">
                {hasSearched && results.length === 0 && (
                    <div className="alert alert-warning" role="alert">
                        No results matched the applied filters.
                    </div>
                )}
                {results.length > 0 && (
                    <div>
                        <h2>Filtered Results</h2>
                        <div className="ht-theme-main-dark-auto">
                            <HotTable
                                data={results}
                                rowHeaders={true}
                                // colHeaders={Object.keys(results[0] || {})}
                                height="auto"
                                stretchH="all"
                                autoWrapRow={true}
                                autoWrapCol={true}
                                manualColumnResize={true}
                                multiColumnSorting={true}
                                filters={true}
                                customBorders={true}
                                dropdownMenu={true}
                                afterChange={handleTableChange} // Track changes in the table
                                cells={(row, col) => {
                                    // Get the column name from the data
                                    const columnName = Object.keys(results[0] || [])[col];

                                    // Define read-only columns
                                    const readOnlyColumns = [
                                        'annotation_id',
                                        'verse_id',
                                        'manuscript_id',
                                        'annotated_object',
                                        'annotated_range',
                                    ];

                                    // Check if the row is marked for deletion
                                    if (deletedRows.has(row)) {
                                        return {
                                            readOnly: true, // Make all cells in the row read-only
                                            className: 'deleted-row', // Apply deletion style
                                        };
                                    }

                                    // Check if the cell is updated
                                    if (updatedCells.has(`${row}-${columnName}`)) {
                                        return { className: 'updated-cell' }; // Highlight updated cells
                                    }

                                    // Check if the column is read-only
                                    if (readOnlyColumns.includes(columnName)) {
                                        return { readOnly: true }; // Make these columns read-only
                                    }

                                    // Default properties for other cells
                                    return {};
                                }}

                                licenseKey="non-commercial-and-evaluation"
                                colHeaders={[...Object.keys(results[0] || {}), "Actions"]}
                                columns={[
                                    ...Object.keys(results[0] || {}).map((key) => ({ data: key })),
                                    {
                                        data: "actions",
                                        renderer: (instance, td, row, col, prop, value) => {
                                            const btn = document.createElement("button");
                                            btn.textContent = deletedRows.has(row) ? "Undo Delete" : "Delete";
                                            btn.className = "btn btn-danger badge-sm";
                                            btn.onclick = () => markForDeletion(row);
                                            td.innerHTML = ""; // Clear cell contents
                                            td.appendChild(btn);
                                        },
                                    },
                                ]}
                            />
                        </div>

                        <button
                            className="btn btn-warning mt-3"
                            onClick={saveChanges}
                            disabled={!saveEnabled}
                        >
                            Save Changes
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchAndFilters;
