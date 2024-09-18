import {ContextMenuProps} from "./types";

const ContextMenu: React.FC<ContextMenuProps> = ({x, y, onClose, onAddAnnotationClicked}) => {
    return (
        <div style={{
            position: 'fixed',
            top: y,
            left: x,
            background: 'white',
            border: '1px solid black',
            padding: '5px',
            zIndex: 1000
        }}>
            <button onClick={() => {
                console.log("clicked.1")
                onAddAnnotationClicked()
            }}>
                Add Annotation
            </button>
        </div>
    );
};

export default ContextMenu;