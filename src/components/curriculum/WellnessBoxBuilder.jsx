import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { X, Plus } from 'lucide-react';

export default function WellnessBoxBuilder({ wellnessItems, customBoxQuantity, onQuantityChange }) {
  const [customBox, setCustomBox] = useState([]);

  const onDragEnd = (result) => {
    if (!result.destination) return;

    if (result.destination.droppableId === 'custom-box') {
      const item = wellnessItems.find(i => i.id === result.draggableId);
      if (item && !customBox.find(i => i.id === item.id)) {
        setCustomBox([...customBox, item]);
      }
    }
  };

  const removeItem = (itemId) => {
    setCustomBox(customBox.filter(item => item.id !== itemId));
  };

  const calculateTotal = () => {
    return customBox.reduce((sum, item) => sum + item.price, 0);
  };

  const updateStepper = (increment) => {
    const newValue = increment ? customBoxQuantity + 1 : Math.max(0, customBoxQuantity - 1);
    onQuantityChange(newValue);
  };

  return (
    <div>
      <style>{`
        .builder-section {
          background: #f4f0e9;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.12),
            -8px -8px 16px rgba(255, 255, 255, 0.9);
          margin-bottom: 24px;
        }

        @media (min-width: 768px) {
          .builder-section {
            padding: 24px;
          }
        }

        .custom-box-area {
          background: rgba(255, 255, 255, 0.5);
          border: 2px dashed #cae5e3;
          border-radius: 12px;
          padding: 20px;
          min-height: 200px;
        }

        .custom-box-item {
          background: white;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }

        .draggable-item {
          background: white;
          border-radius: 8px;
          padding: 8px;
          margin-bottom: 8px;
          cursor: grab;
          box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.08);
          transition: all 0.2s;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .draggable-item:hover {
          box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.12);
          transform: translateY(-2px);
        }

        .draggable-item:active {
          cursor: grabbing;
        }

        .draggable-item img {
          width: 40px;
          height: 40px;
          object-fit: cover;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .items-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          max-height: 400px;
          overflow-y: auto;
          padding-right: 8px;
        }

        @media (min-width: 768px) {
          .items-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .price-badge {
          background: #eaf995;
          color: #264d44;
          padding: 4px 8px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
        }

        .item-name {
          font-size: 11px;
          font-weight: 600;
          color: #264d44;
          flex: 1;
          line-height: 1.3;
        }

        @media (min-width: 768px) {
          .item-name {
            font-size: 12px;
          }
        }

        .neuro-stepper {
          background: #f4f0e9;
          border-radius: 12px;
          padding: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 
            inset 3px 3px 6px rgba(0, 0, 0, 0.1),
            inset -3px -3px 6px rgba(255, 255, 255, 0.8);
        }

        .neuro-stepper-btn {
          background: #f4f0e9;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 20px;
          color: #441d37;
          font-weight: bold;
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.12),
            -4px -4px 8px rgba(255, 255, 255, 0.9);
          transition: all 0.2s ease;
        }

        .neuro-stepper-btn:hover {
          box-shadow: 
            3px 3px 6px rgba(0, 0, 0, 0.15),
            -3px -3px 6px rgba(255, 255, 255, 0.95);
        }

        .neuro-stepper-btn:active {
          box-shadow: 
            inset 2px 2px 4px rgba(0, 0, 0, 0.2),
            inset -2px -2px 4px rgba(255, 255, 255, 0.1);
        }
      `}</style>

      <div className="builder-section">
        <h3 className="text-xl md:text-2xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Build Your Custom Wellness Box
        </h3>
        <p className="text-sm mb-4" style={{ color: '#666' }}>
          Drag items from the available wellness products into your custom box to see pricing
        </p>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Available Items */}
            <div>
              <h4 className="text-base font-bold mb-3" style={{ color: '#264d44' }}>
                Available Items ({wellnessItems.length})
              </h4>
              <Droppable droppableId="available-items">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="items-grid"
                  >
                    {wellnessItems.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="draggable-item"
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.8 : 1,
                            }}
                          >
                            <img src={item.image} alt={item.name} />
                            <span className="item-name">{item.name}</span>
                            <span className="price-badge">
                              ${item.price.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Custom Box */}
            <div>
              <h4 className="text-base font-bold mb-3" style={{ color: '#264d44' }}>
                Your Custom Box ({customBox.length} items)
              </h4>
              <Droppable droppableId="custom-box">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="custom-box-area"
                    style={{
                      background: snapshot.isDraggingOver ? 'rgba(202, 229, 227, 0.3)' : 'rgba(255, 255, 255, 0.5)',
                    }}
                  >
                    {customBox.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center" style={{ color: '#999' }}>
                        <Plus className="w-8 h-8 mb-2" />
                        <p className="text-sm">Drag items here to build your box</p>
                      </div>
                    ) : (
                      <>
                        {customBox.map((item) => (
                          <div key={item.id} className="custom-box-item">
                            <span className="text-sm font-semibold" style={{ color: '#264d44' }}>
                              {item.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="price-badge">
                                ${item.price.toFixed(2)}
                              </span>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="mt-4 pt-4 border-t-2" style={{ borderColor: '#cae5e3' }}>
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold" style={{ color: '#264d44' }}>
                              Total Cost:
                            </span>
                            <span className="text-2xl font-bold" style={{ color: '#770142' }}>
                              ${calculateTotal().toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs mt-1 text-right" style={{ color: '#666' }}>
                            (estimated before shipping)
                          </p>
                        </div>
                      </>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        </DragDropContext>

        {/* Quantity Selector for Custom Boxes */}
        {customBox.length > 0 && (
          <div className="mt-6 pt-6 border-t-2" style={{ borderColor: '#cae5e3' }}>
            <h4 className="text-base font-bold mb-3" style={{ color: '#264d44' }}>
              How many of these custom boxes would you like?
            </h4>
            <div className="neuro-stepper" style={{ maxWidth: '300px' }}>
              <button 
                className="neuro-stepper-btn"
                onClick={() => updateStepper(false)}
              >
                −
              </button>
              <span className="flex-1 text-center text-lg md:text-xl font-bold" style={{ color: '#333' }}>
                {customBoxQuantity}
              </span>
              <button 
                className="neuro-stepper-btn"
                onClick={() => updateStepper(true)}
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}