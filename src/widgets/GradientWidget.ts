import type { LGraphCanvas } from "@/LGraphCanvas"
import type { LGraphNode } from "@/LGraphNode"
import type { CanvasMouseEvent } from "@/types/events"
import type { IGradientWidget, IWidgetGradientOptions, IWidgetGradientStop } from "@/types/widgets"

import { BaseWidget, type DrawWidgetOptions } from "./BaseWidget"

// Global singleton color input element for stop color editing
let globalColorInput: HTMLInputElement | null = null;
let activeGradientWidget: GradientWidget | null = null;
let activeStopIndex: number = -1;
let currentOptions: {
  e: CanvasMouseEvent;
  node: LGraphNode;
  canvas: LGraphCanvas;
} | null = null;
let animationFrameId: number | null = null;
let pendingUpdate = false;

// Create or get the global color input
function getGlobalColorInput(): HTMLInputElement {
  if (!globalColorInput) {
    globalColorInput = document.createElement("input");
    globalColorInput.type = "color";
    globalColorInput.style.position = "absolute";
    globalColorInput.style.width = "0";
    globalColorInput.style.height = "0";
    globalColorInput.style.padding = "0";
    globalColorInput.style.border = "none"; 
    globalColorInput.style.opacity = "0";
    globalColorInput.style.zIndex = "10000";
    document.body.appendChild(globalColorInput);
    
    // Handle color changes immediately
    globalColorInput.addEventListener("input", () => {
      if (globalColorInput && activeGradientWidget && currentOptions && activeStopIndex !== -1) {
        const stops = [...activeGradientWidget.value];
        stops[activeStopIndex].color = globalColorInput.value;
        activeGradientWidget.setValue(stops, currentOptions);
      }
    });
    
    // Handle blur and change to hide
    globalColorInput.addEventListener("blur", hideGlobalColorInput);
    globalColorInput.addEventListener("change", hideGlobalColorInput);
  }
  return globalColorInput;
}

// Schedule a color update for next animation frame
function handleColorChange() {
  if (!globalColorInput || !activeGradientWidget || !currentOptions || activeStopIndex === -1) return;
  
  // If we don't have a pending update, schedule one for the next frame
  if (!pendingUpdate) {
    pendingUpdate = true;
    
    // Cancel any existing animation frame request
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    
    // Schedule the update for the next animation frame
    animationFrameId = requestAnimationFrame(() => {
      applyColorChange();
      pendingUpdate = false;
      animationFrameId = null;
    });
  }
}

// Apply the current color change to the active stop
function applyColorChange() {
  if (globalColorInput && activeGradientWidget && currentOptions && activeStopIndex !== -1) {
    const stops = [...activeGradientWidget.value];
    stops[activeStopIndex].color = globalColorInput.value;
    activeGradientWidget.setValue(stops, currentOptions);
  }
}

// Hide the global color input
function hideGlobalColorInput() {
  if (globalColorInput) {
    globalColorInput.style.left = "-9999px";
    globalColorInput.style.top = "-9999px";
  }
  
  // Cancel any pending animation frame
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  pendingUpdate = false;
  activeGradientWidget = null;
  activeStopIndex = -1;
  currentOptions = null;
}

export class GradientWidget extends BaseWidget implements IGradientWidget {
  declare type: "gradient";
  declare value: IWidgetGradientStop[];
  declare options: IWidgetGradientOptions;
  
  // State variable - only one needed for selection and dragging
  private selectedStopIndex: number = -1;
  
  // Stored areas for interaction
  private gradientRect: { x: number, y: number, width: number, height: number } = { x: 0, y: 0, width: 0, height: 0 };
  private stopAreaRect: { x: number, y: number, width: number, height: number } = { x: 0, y: 0, width: 0, height: 0 };
  
  constructor(widget: IGradientWidget) {
    super(widget);
    this.type = "gradient";
    
    // Ensure we have at least two stops by default
    if (!widget.value || widget.value.length < 2) {
      this.value = [
        { position: 0, color: "#ffffff" },
        { position: 1, color: "#000000" }
      ];
    } else {
      this.value = widget.value;
    }
    
    this.options = widget.options || {};
  }
  
  /**
   * Draws the widget
   * @param ctx The canvas context
   * @param options The options for drawing the widget
   */
  override drawWidget(ctx: CanvasRenderingContext2D, {
    y,
    width,
    show_text = true,
    margin = 15,
  }: DrawWidgetOptions) {
    // Store original context attributes
    const originalTextAlign = ctx.textAlign;
    const originalStrokeStyle = ctx.strokeStyle;
    const originalFillStyle = ctx.fillStyle;
    const originalLineWidth = ctx.lineWidth;
    
    const { height } = this;
    const stopSize = 14;
    const halfStopSize = stopSize / 2;
    
    // Constants for layout
    const gradientHeight = height * 0.5;
    const stopAreaHeight = height * 0.3;
    const gradientY = y + height * 0.1;
    const stopAreaY = gradientY + gradientHeight + 5;
    
    // Store areas for interaction
    this.gradientRect = {
      x: margin,
      y: gradientY,
      width: width - margin * 2,
      height: gradientHeight
    };
    
    this.stopAreaRect = {
      x: margin,
      y: stopAreaY,
      width: width - margin * 2,
      height: stopAreaHeight
    };
    
    // Draw gradient container with border
    ctx.fillStyle = this.options.background_color || this.background_color;
    ctx.lineWidth = 1;
    ctx.strokeStyle = this.options.border_color || this.outline_color;
    ctx.fillRect(margin, gradientY, width - margin * 2, gradientHeight);
    ctx.strokeRect(margin, gradientY, width - margin * 2, gradientHeight);
    
    // Draw stop area with light grey background
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(margin, stopAreaY, width - margin * 2, stopAreaHeight);
    ctx.strokeRect(margin, stopAreaY, width - margin * 2, stopAreaHeight);
    
    // Draw the actual gradient
    if (this.value.length >= 2) {
      // Sort stops by position
      const sortedStops = [...this.value].sort((a, b) => a.position - b.position);
      
      // Create gradient
      const gradient = ctx.createLinearGradient(margin, 0, width - margin, 0);
      
      // Add color stops
      for (const stop of sortedStops) {
        gradient.addColorStop(stop.position, stop.color);
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(margin, gradientY, width - margin * 2, gradientHeight);
    }
    
    // Draw handles/stops if not disabled
    if (!this.disabled) {
      // Draw track in the middle of the stop area
      const trackY = stopAreaY + stopAreaHeight / 2;
      
      // Draw stop markers
      for (let i = 0; i < this.value.length; i++) {
        const stop = this.value[i];
        const isSelected = i === this.selectedStopIndex;
        
        // Calculate stop position
        const stopX = margin + stop.position * (width - margin * 2);
        const stopY = trackY;
        
        // Draw stop marker
        ctx.beginPath();
        ctx.fillStyle = stop.color;
        
        // Draw diamond-shaped marker
        ctx.moveTo(stopX, stopY - halfStopSize);
        ctx.lineTo(stopX + halfStopSize, stopY);
        ctx.lineTo(stopX, stopY + halfStopSize);
        ctx.lineTo(stopX - halfStopSize, stopY);
        
        ctx.closePath();
        ctx.fill();
        
        // Draw border - yellow for selected, black otherwise
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeStyle = isSelected ? "#ff9900" : "#000000";
        ctx.stroke();
      }
    }
    
    // Draw label
    if (show_text) {
      ctx.fillStyle = this.text_color;
      ctx.textAlign = "left";
      const label = this.label || this.name;
      if (label != null) {
        ctx.fillText(label, margin, y + height * 0.08);
      }
    }
    
    // Restore original context attributes
    ctx.textAlign = originalTextAlign;
    ctx.strokeStyle = originalStrokeStyle;
    ctx.fillStyle = originalFillStyle;
    ctx.lineWidth = originalLineWidth;
  }
  
  /**
   * Checks if a point is over a gradient stop
   */
  private getStopAtPosition(x: number, y: number): number {
    const stopSize = 14;
    const hitArea = stopSize * 1.5; // Make the hit area larger than the visual size
      
    // Calculate track position
    const trackY = this.gradientRect.y + this.gradientRect.height + 6; // Track is below
      
    for (let i = 0; i < this.value.length; i++) {
      const stop = this.value[i];
      
      // Calculate stop position
      const stopX = this.gradientRect.x + stop.position * this.gradientRect.width;
      const stopY = trackY;
      
      // Check if point is within the stop marker
      if (Math.abs(x - stopX) <= hitArea / 2 && Math.abs(y - stopY) <= hitArea / 2) {
        return i;
      }
    }
    
    return -1;
  }
  
  /**
   * Check if point is within the gradient rect
   */
  private isOverGradient(x: number, y: number): boolean {
    return (
      x >= this.gradientRect.x && 
      x <= this.gradientRect.x + this.gradientRect.width && 
      y >= this.gradientRect.y && 
      y <= this.gradientRect.y + this.gradientRect.height
    );
  }

  /**
   * Check if point is within the stop area
   */
  private isInStopArea(x: number, y: number): boolean {
    return (
      x >= this.stopAreaRect.x && 
      x <= this.stopAreaRect.x + this.stopAreaRect.width && 
      y >= this.stopAreaRect.y && 
      y <= this.stopAreaRect.y + this.stopAreaRect.height
    );
  }
  
  /**
   * Get normalized position (0-1) from x, y coordinates
   */
  private getNormalizedPosition(x: number, y: number): number {
    return Math.max(0, Math.min(1, (x - this.gradientRect.x) / this.gradientRect.width));
  }
  
  /**
   * Add a new gradient stop
   */
  private addStop(position: number, color: string, options: {
    e: CanvasMouseEvent,
    node: LGraphNode,
    canvas: LGraphCanvas
  }): number {
    const minStops = this.options.min_stops || 2;
    
    // Create new stops array with the new stop
    const newStops = [...this.value, { position, color }];
    
    // Sort by position
    newStops.sort((a, b) => a.position - b.position);
    
    // Find the index of our new stop
    const newStopIndex = newStops.findIndex(s => s.position === position && s.color === color);
    
    // Update the value
    this.setValue(newStops, options);
    
    return newStopIndex;
  }
  
  /**
   * Handle mouse down events
   */
  onMouseDown(e: CanvasMouseEvent, localPos: [number, number], node: LGraphNode) {
    if (this.disabled || this.options.read_only) return false;
    
    const x = localPos[0];
    const y = localPos[1];
    
    // Check if clicking on a stop
    const clickedStopIndex = this.getStopAtPosition(x, y);
    
    // If clicking on a stop, select it for dragging
    if (clickedStopIndex !== -1) {
      // Select this stop - update both local and global selection
      this.selectedStopIndex = clickedStopIndex;
      activeStopIndex = clickedStopIndex;
      
      // Capture mouse for dragging
      node.captureInput(true);
      return true;
    }
    
    // If clicking elsewhere, deselect
    if (this.selectedStopIndex !== -1 || activeStopIndex !== -1) {
      this.selectedStopIndex = -1;
      activeStopIndex = -1;
      return true;
    }
    
    return false;
  }
  
  /**
   * Handle click events
   */
  override onClick(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    if (this.options.read_only) return;

    const { e, node, canvas } = options;
    const x = e.canvasX - node.pos[0];
    const y = e.canvasY - node.pos[1];
    
    // Check if clicking on a stop
    const clickedStopIndex = this.getStopAtPosition(x, y);
    if (clickedStopIndex !== -1) {
      // If clicking the already selected/active stop, open color picker
      if (clickedStopIndex === activeStopIndex) {
        this.openColorPicker(clickedStopIndex, options);
      } else {
        // Select this stop - update both internal and global selection
        this.selectedStopIndex = clickedStopIndex;
        activeStopIndex = clickedStopIndex;
      }
      return true;
    }
    
    // Check if clicking on the gradient
    if (this.isOverGradient(x, y)) {
      // Add a new stop
      const position = this.getNormalizedPosition(x, y);
      const color = this.getColorAtPosition(position);
      
      // Add the stop and select it
      const newStopIndex = this.addStop(position, color, options);
      if (newStopIndex !== -1) {
        // Update both internal and global selection
        this.selectedStopIndex = newStopIndex;
        activeStopIndex = newStopIndex;
      }
      
      return true;
    }
    
    // Clicking elsewhere deselects
    if (activeStopIndex !== -1 || this.selectedStopIndex !== -1) {
      this.selectedStopIndex = -1;
      activeStopIndex = -1;
      return true;
    }
    
    return false;
  }
  
  /**
   * Handle drag events - update the position using the mouse event
   */
  override onDrag(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    if (this.options.read_only) return false;
    
    const { e, node, canvas } = options;
    const x = e.canvasX - node.pos[0];
    const y = e.canvasY - node.pos[1];
    
    // Only drag if the internal selection matches the global activeStopIndex
    // This prevents dragging stops that aren't visually selected with yellow outline
    if (this.selectedStopIndex !== -1 && this.selectedStopIndex === activeStopIndex) {
      // Check if dragging far enough down to delete the stop
      const deleteThreshold = this.stopAreaRect.y + this.stopAreaRect.height + 50;
      if (y > deleteThreshold && this.value.length > 2) {
        // Remove the stop
        const newStops = [...this.value];
        newStops.splice(this.selectedStopIndex, 1);
        
        // Update the value
        this.setValue(newStops, options);
        
        // Clear selection
        this.selectedStopIndex = -1;
        activeStopIndex = -1;
        
        // Release capture
        node.captureInput(false);
        
        return true;
      }
      
      // Otherwise, update position of selected stop horizontally
      const position = this.getNormalizedPosition(x, y);
      
      // Create new stops array with updated position
      const newStops = [...this.value];
      newStops[this.selectedStopIndex].position = position;
      
      // Update the value
      this.setValue(newStops, options);
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Calculate the color at a specific position in the gradient
   */
  private getColorAtPosition(position: number): string {
    if (this.value.length === 0) return "#ffffff";
    if (this.value.length === 1) return this.value[0].color;
    
    // Sort stops by position
    const sortedStops = [...this.value].sort((a, b) => a.position - b.position);
    
    // If position is outside the range, return edge colors
    if (position <= sortedStops[0].position) return sortedStops[0].color;
    if (position >= sortedStops[sortedStops.length - 1].position) return sortedStops[sortedStops.length - 1].color;
    
    // Find the two stops we're between
    let lower = sortedStops[0];
    let upper = sortedStops[sortedStops.length - 1];
    
    for (let i = 0; i < sortedStops.length - 1; i++) {
      if (position >= sortedStops[i].position && position <= sortedStops[i + 1].position) {
        lower = sortedStops[i];
        upper = sortedStops[i + 1];
        break;
      }
    }
    
    // Calculate the color
    return this.interpolateColor(lower.color, upper.color, (position - lower.position) / (upper.position - lower.position));
  }
  
  /**
   * Linear interpolation between two colors
   */
  private interpolateColor(color1: string, color2: string, factor: number): string {
    // Convert hex to rgb
    const r1 = parseInt(color1.substr(1, 2), 16);
    const g1 = parseInt(color1.substr(3, 2), 16);
    const b1 = parseInt(color1.substr(5, 2), 16);
    
    const r2 = parseInt(color2.substr(1, 2), 16);
    const g2 = parseInt(color2.substr(3, 2), 16);
    const b2 = parseInt(color2.substr(5, 2), 16);
    
    // Interpolate
    const r = Math.round(r1 + factor * (r2 - r1));
    const g = Math.round(g1 + factor * (g2 - g1));
    const b = Math.round(b1 + factor * (b2 - b1));
    
    // Convert back to hex
    return `#${(r).toString(16).padStart(2, '0')}${(g).toString(16).padStart(2, '0')}${(b).toString(16).padStart(2, '0')}`;
  }
  
  /**
   * Open the color picker for a stop
   */
  private openColorPicker(stopIndex: number, options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    const { e } = options;
    
    // Set active widget and stop
    activeGradientWidget = this;
    activeStopIndex = stopIndex;
    currentOptions = options;
    
    // Get and position color input
    const colorInput = getGlobalColorInput();
    colorInput.value = this.value[stopIndex].color;
    
    // Position where the mouse is
    colorInput.style.left = `${e.clientX}px`;
    colorInput.style.top = `${e.clientY}px`;
    
    // Make it functional
    colorInput.style.pointerEvents = "auto";
    
    // Open the color picker directly
    colorInput.focus();
    colorInput.click();
  }

  /**
   * Remove a stop by index
   */
  private removeStop(index: number, options: {
    e: CanvasMouseEvent,
    node: LGraphNode,
    canvas: LGraphCanvas
  }) {
    // Don't allow removing if we only have 2 stops
    if (this.value.length <= 2) return;
    
    // Create new stops array without the selected stop
    const newStops = this.value.filter((_, i) => i !== index);
    
    // Update the value
    this.setValue(newStops, options);
    
    // Clear selection
    this.selectedStopIndex = -1;
    activeStopIndex = -1;
  }

  /**
   * Handle global clicks outside this widget to deselect
   * This needs to be called by the node hosting this widget
   */
  onGlobalClick(e: MouseEvent, node: LGraphNode, canvas: LGraphCanvas) {
    // If we have something selected
    if (this.selectedStopIndex !== -1) {
      // Get position in canvas space
      const rect = canvas.canvas.getBoundingClientRect();
      if (!rect) return;
      
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      
      // Convert to node local space
      const localX = canvasX - node.pos[0];
      const localY = canvasY - node.pos[1];
      
      // Check if outside the widget area
      const isOutsideWidget = 
        localX < 0 || 
        localX > node.size[0] ||
        localY < 0 || 
        localY > node.size[1];
      
      // Also check if outside both gradient and stop areas
      const isOutsideGradientAndStopAreas = 
        !this.isOverGradient(localX, localY) && 
        !this.isInStopArea(localX, localY);
      
      // If outside the widget or both areas, deselect
      if (isOutsideWidget || isOutsideGradientAndStopAreas) {
        this.selectedStopIndex = -1;
        activeStopIndex = -1;
        return true;
      }
    }
    
    return false;
  }
} 