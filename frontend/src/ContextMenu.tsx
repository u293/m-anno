import React, {useState, useEffect, useRef, useCallback} from 'react';
import {ContextMenuProps} from "./types";
import axios from 'axios';

interface Template {
    id: string;
    annotation: string;
    annotation_Language: string;
    annotation_transliteration: string;
    annotation_type: string;
    other: string;
    displayText: string;
    template_name?: string;
}

interface EnhancedContextMenuProps extends ContextMenuProps {
    onAddAnnotationFromTemplate: (template: Template) => void;
    manuscriptId: string;
    verseId: string;
    annotatedObject: string;
    selectedRange: string;
}

const ContextMenu: React.FC<EnhancedContextMenuProps> = ({
                                                             x,
                                                             y,
                                                             onClose,
                                                             onAddAnnotationClicked,
                                                             onAddAnnotationFromTemplate,
                                                             manuscriptId,
                                                             verseId,
                                                             annotatedObject,
                                                             selectedRange
                                                         }) => {
    const [showTemplateSubmenu, setShowTemplateSubmenu] = useState(false);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
    const [recentTemplates, setRecentTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const contextMenuRef = useRef<HTMLDivElement>(null);
    const submenuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Store the current selection to preserve it - capture immediately on mount
    const preservedSelectionRef = useRef({
        text: annotatedObject,
        range: selectedRange
    });

    // Update preserved selection immediately when component mounts
    useEffect(() => {
        preservedSelectionRef.current = {
            text: annotatedObject,
            range: selectedRange
        };
        console.log('Preserved selection:', preservedSelectionRef.current);
    }, []); // Only run on mount

    // Load recent templates on component mount
    useEffect(() => {
        loadRecentTemplates();
    }, [manuscriptId]);

    // Filter templates based on search query
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredTemplates(recentTemplates);
        } else {
            const filtered = templates.filter(template =>
                (template.template_name && template.template_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                template.displayText.toLowerCase().includes(searchQuery.toLowerCase()) ||
                template.annotation.toLowerCase().includes(searchQuery.toLowerCase()) ||
                template.annotation_Language.toLowerCase().includes(searchQuery.toLowerCase()) ||
                template.annotation_type.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredTemplates(filtered);
        }
    }, [searchQuery, templates, recentTemplates]);

    // Close menu when clicking outside - FIXED VERSION
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            console.log('Click outside detected:', event.target);
            const target = event.target as Node;

            // Check if click is inside context menu or submenu
            const isInsideContextMenu = contextMenuRef.current && contextMenuRef.current.contains(target);
            const isInsideSubmenu = submenuRef.current && submenuRef.current.contains(target);

            console.log('Inside context menu:', isInsideContextMenu);
            console.log('Inside submenu:', isInsideSubmenu);

            // Don't close if clicking inside either menu
            if (!isInsideContextMenu && !isInsideSubmenu) {
                console.log('Closing context menu due to outside click');
                onClose();
            } else {
                console.log('Click was inside menu, not closing');
            }
        };

        // Use a slight delay to ensure the menu is fully rendered before adding the listener
        const timeoutId = setTimeout(() => {
            console.log('Adding click outside listener');
            document.addEventListener('mousedown', handleClickOutside);
        }, 50);

        return () => {
            console.log('Removing click outside listener');
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Auto-focus search input when submenu opens
    useEffect(() => {
        if (showTemplateSubmenu && searchInputRef.current) {
            // Small delay to ensure the submenu is rendered
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [showTemplateSubmenu]);

    const loadRecentTemplates = async () => {
        console.log('Loading recent templates for manuscript:', manuscriptId);
        setIsLoading(true);
        try {
            const response = await axios.get<Template[]>(
                `http://localhost:5000/get_template_suggestions?manuscript=${manuscriptId}&query=&recent=true`
            );

            console.log('Loaded templates:', response.data);
            const allTemplates = response.data;
            setTemplates(allTemplates);
            setRecentTemplates(allTemplates.slice(0, 10));
            setFilteredTemplates(allTemplates.slice(0, 10));
        } catch (error) {
            console.error('Error loading templates:', error);
            setTemplates([]);
            setRecentTemplates([]);
            setFilteredTemplates([]);
        } finally {
            setIsLoading(false);
        }
    };

    const searchTemplates = async (query: string) => {
        if (query.trim() === '') {
            setFilteredTemplates(recentTemplates);
            return;
        }

        try {
            const response = await axios.get<Template[]>(
                `http://localhost:5000/get_template_suggestions?manuscript=${manuscriptId}&query=${query}`
            );
            setFilteredTemplates(response.data);
        } catch (error) {
            console.error('Error searching templates:', error);
            setFilteredTemplates([]);
        }
    };

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        searchTemplates(query);
    }, [manuscriptId, recentTemplates]);

    // Prevent input events from bubbling up and causing menu to close
    const handleSearchInputEvents = useCallback((e: React.MouseEvent | React.FocusEvent) => {
        e.stopPropagation();
        console.log('Search input event:', e.type);
    }, []);

    const handleTemplateSelect = useCallback(async (template: Template) => {
        console.log('Template selected:', template);
        console.log('Preserved selection at selection time:', preservedSelectionRef.current);

        try {
            // Increment template popularity first
            console.log('Incrementing popularity for template:', template.id);
            await axios.post('http://localhost:5000/increment_template_popularity', {
                template_id: template.id
            });
            console.log('Popularity incremented successfully');

            // Create annotation object with template data using preserved selection
            const annotationData = {
                manuscript_id: manuscriptId,
                verse_id: verseId,
                annotated_object: preservedSelectionRef.current.text,
                annotated_range: preservedSelectionRef.current.range,
                annotation_id: '',
                annotation: template.annotation,
                annotation_Language: template.annotation_Language,
                annotation_transliteration: template.annotation_transliteration,
                annotation_type: template.annotation_type,
                other: template.other,
                flag: false
            };

            console.log('Saving annotation with data:', annotationData);

            // Save annotation directly
            const response = await axios.post('http://localhost:5000/save_annotation', annotationData);
            console.log('Template annotation saved:', response.data);

            // Call the callback to notify parent component
            onAddAnnotationFromTemplate(template);

            // Close context menu
            onClose();

        } catch (error) {
            console.error('Error saving annotation from template:', error);
            alert('Error saving annotation from template: ' + error);
        }
    }, [manuscriptId, verseId, onAddAnnotationFromTemplate, onClose]);

    const handleShowTemplateSubmenu = useCallback(() => {
        console.log('Showing template submenu');
        setShowTemplateSubmenu(true);
    }, []);

    const handleHideTemplateSubmenu = useCallback(() => {
        console.log('Hiding template submenu');
        setShowTemplateSubmenu(false);
    }, []);

    const submenuX = x + 200;
    const submenuY = y + 30;

    console.log('Rendering ContextMenu:', {
        showTemplateSubmenu,
        filteredTemplatesCount: filteredTemplates.length,
        preservedSelection: preservedSelectionRef.current
    });

    return (
        <>
            {/* Main Context Menu */}
            <div
                ref={contextMenuRef}
                style={{
                    position: 'fixed',
                    top: y,
                    left: x,
                    background: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '4px 0',
                    zIndex: 1000,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    minWidth: '180px'
                }}
            >
                <button
                    onClick={() => {
                        console.log("Add annotation clicked");
                        onAddAnnotationClicked();
                    }}
                    style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 16px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f0f0f0';
                        setShowTemplateSubmenu(false);
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                    }}
                >
                    Add Annotation
                </button>

                <button
                    onMouseEnter={handleShowTemplateSubmenu}
                    onClick={handleShowTemplateSubmenu}
                    style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 16px',
                        border: 'none',
                        background: showTemplateSubmenu ? '#f0f0f0' : 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        position: 'relative'
                    }}
                >
                    Add annotation from template
                    <span style={{float: 'right', marginLeft: '10px'}}>▶</span>
                </button>
            </div>

            {/* Template Submenu */}
            {showTemplateSubmenu && (
                <div
                    ref={submenuRef}
                    style={{
                        position: 'fixed',
                        top: submenuY,
                        left: submenuX,
                        background: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '8px',
                        zIndex: 1001,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                        minWidth: '300px',
                        maxHeight: '400px',
                        overflowY: 'auto'
                    }}
                    // Prevent submenu clicks from propagating
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Debug Info */}
                    <div style={{
                        marginBottom: '8px',
                        padding: '4px 8px',
                        backgroundColor: '#e3f2fd',
                        borderRadius: '3px',
                        fontSize: '10px',
                        color: '#1976d2'
                    }}>
                        <div><strong>Selected Text:</strong> "{preservedSelectionRef.current.text}"</div>
                        <div><strong>Range:</strong> {preservedSelectionRef.current.range}</div>
                        <div><strong>Templates:</strong> {filteredTemplates.length}</div>
                    </div>

                    {/* Search Box */}
                    <div style={{marginBottom: '8px'}}>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onFocus={handleSearchInputEvents}
                            onClick={handleSearchInputEvents}
                            onMouseDown={handleSearchInputEvents}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                border: '1px solid #ddd',
                                borderRadius: '3px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Templates List */}
                    <div style={{borderTop: '1px solid #eee', paddingTop: '8px'}}>
                        {isLoading ? (
                            <div style={{
                                padding: '12px',
                                color: '#666',
                                fontSize: '13px',
                                textAlign: 'center'
                            }}>
                                Loading templates...
                            </div>
                        ) : filteredTemplates.length === 0 ? (
                            <div style={{
                                padding: '12px',
                                color: '#666',
                                fontSize: '13px',
                                textAlign: 'center'
                            }}>
                                {searchQuery ? 'No templates found' : 'No templates available'}
                            </div>
                        ) : (
                            <>
                                {!searchQuery && (
                                    <div style={{
                                        fontSize: '11px',
                                        color: '#888',
                                        marginBottom: '8px',
                                        paddingLeft: '8px'
                                    }}>
                                        POPULAR TEMPLATES
                                    </div>
                                )}
                                {filteredTemplates.map((template, index) => (
                                    <button
                                        key={`${template.id}-${index}`}
                                        type="button"
                                        onMouseDown={(e) => {
                                            console.log('Template mousedown:', template.id);
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        onClick={(e) => {
                                            console.log('Template button clicked:', template.id);
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleTemplateSelect(template);
                                        }}
                                        onMouseUp={(e) => {
                                            console.log('Template mouseup:', template.id);
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            borderRadius: '3px',
                                            fontSize: '13px',
                                            marginBottom: '2px',
                                            border: '1px solid transparent',
                                            userSelect: 'none',
                                            background: 'transparent',
                                            textAlign: 'left'
                                        }}
                                        onMouseEnter={(e) => {
                                            console.log('Template mouseenter:', template.id);
                                            e.currentTarget.style.background = '#f0f8ff';
                                            e.currentTarget.style.borderColor = '#2196f3';
                                        }}
                                        onMouseLeave={(e) => {
                                            console.log('Template mouseleave:', template.id);
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.borderColor = 'transparent';
                                        }}
                                    >
                                        <div style={{fontWeight: 'bold', marginBottom: '2px'}}>
                                            {template.template_name || template.displayText || 'Unnamed Template'}
                                        </div>
                                        {/*<div style={{fontSize: '11px', color: '#666'}}>*/}
                                        {/*    {template.annotation && (*/}
                                        {/*        <span>Annotation: {template.annotation.substring(0, 50)}*/}
                                        {/*            {template.annotation.length > 50 ? '...' : ''}</span>*/}
                                        {/*    )}*/}
                                        {/*</div>*/}
                                        {/*<div style={{fontSize: '10px', color: '#999', marginTop: '2px'}}>*/}
                                        {/*    ID: {template.id}*/}
                                        {/*</div>*/}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default ContextMenu;