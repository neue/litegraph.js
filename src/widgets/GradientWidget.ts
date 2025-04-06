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
    globalColorInput.style.pointerEvents = "none";
    globalColorInput.style.zIndex = "10000";
    document.body.appendChild(globalColorInput);
    
    // Handle color changes with animation frame throttling
    globalColorInput.addEventListener("input", handleColorChange);
    
    // Handle blur for cleanup
    globalColorInput.addEventListener("blur", hideGlobalColorInput);
    
    // Handle change for final value
    globalColorInput.addEventListener("change", () => {
      // Always apply the final value immediately
      if (globalColorInput && activeGradientWidget && currentOptions && activeStopIndex !== -1) {
        applyColorChange();
      }
      setTimeout(hideGlobalColorInput, 100);
    });
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
  
  // State variables for interaction
  private draggingStopIndex: number = -1;
  private hoverStopIndex: number = -1;
  private gradientRect: { x: number, y: number, width: number, height: number } = { x: 0, y: 0, width: 0, height: 0 };
  
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
    
    // Draw background
    ctx.fillStyle = this.options.background_color || this.background_color;
    ctx.lineWidth = 1;
    ctx.strokeStyle = this.options.border_color || this.outline_color;
    
    // Draw gradient container
    const gradientHeight = height * 0.65;
    const gradientY = y + (height - gradientHeight) / 2;
    
    // Store gradient rect for interaction
    this.gradientRect = {
      x: margin,
      y: gradientY,
      width: width - margin * 2,
      height: gradientHeight
    };
    
    // Draw gradient container
    ctx.fillRect(margin, gradientY, width - margin * 2, gradientHeight);
    ctx.strokeRect(margin, gradientY, width - margin * 2, gradientHeight);
    
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
      // Track for stop position
      const trackY = gradientY + gradientHeight + 6; // Track is below the gradient
      
      // Draw stop markers
      for (let i = 0; i < this.value.length; i++) {
        const stop = this.value[i];
        const isSelected = i === activeStopIndex;
        const isHovered = i === this.hoverStopIndex;
        
        // Calculate stop position
        const stopX = margin + stop.position * (width - margin * 2); // Position for horizontal
        const stopY = trackY; // Fixed for horizontal
        
        // Draw stop marker
        ctx.beginPath();
        ctx.fillStyle = stop.color;
        
        // Draw arrow/triangle marker
        ctx.moveTo(stopX, stopY - halfStopSize);
        ctx.lineTo(stopX + halfStopSize, stopY);
        ctx.lineTo(stopX, stopY + halfStopSize);
        ctx.lineTo(stopX - halfStopSize, stopY);
        
        ctx.closePath();
        ctx.fill();
        
        // Draw border with thicker stroke for selected/hovered
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeStyle = isSelected 
          ? "#ff9900" 
          : (isHovered ? "#ffffff" : "#000000");
        ctx.stroke();
      }
    }
    
    // Draw label
    if (show_text) {
      ctx.fillStyle = this.text_color;
      ctx.textAlign = "left";
      const label = this.label || this.name;
      if (label != null) {
        ctx.fillText(label, margin, y + height * 0.25);
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
    const hitArea = stopSize * 1.0; // Make the hit area larger than the visual size
    
    // Calculate track position
    const trackY = this.gradientRect.y + this.gradientRect.height + 6; // Track is below
      
    for (let i = 0; i < this.value.length; i++) {
      const stop = this.value[i];
      
      // Calculate stop position
      const stopX = this.gradientRect.x + stop.position * this.gradientRect.width; // Position for horizontal
      const stopY = trackY; // Fixed for horizontal
      
      // Check if point is within the stop marker (with larger hit area)
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
   * Remove a gradient stop
   */
  private removeStop(index: number, options: {
    e: CanvasMouseEvent,
    node: LGraphNode,
    canvas: LGraphCanvas
  }): void {
    const minStops = this.options.min_stops || 2;
    
    // Check if we can remove stops
    if (this.value.length <= minStops) return;
    
    // Create new stops array without the selected stop
    const newStops = this.value.filter((_, i) => i !== index);
    
    // Update the value
    this.setValue(newStops, options);
  }
  
  /**
   * Handle mouse events internally to consistently update hover state 
   */
  private processMouseMove(x: number, y: number) {
    // Always update hover state on any mouse movement
    const prevHoverIndex = this.hoverStopIndex;
    this.hoverStopIndex = this.getStopAtPosition(x, y);
    
    return prevHoverIndex !== this.hoverStopIndex;
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
    
    // Always update hover state
    this.processMouseMove(x, y);
    
    // Check if clicking on a stop
    if (this.hoverStopIndex !== -1) {
      // Start dragging this stop
      this.draggingStopIndex = this.hoverStopIndex;
      
      // Capture mouse
      node.captureInput(true);
      return true;
    }
    
    // Check if clicking on the gradient
    if (this.isOverGradient(x, y)) {
      // Add a new stop
      const position = this.getNormalizedPosition(x, y);
      
      // Use the color at this position in the gradient
      const color = this.getColorAtPosition(position);
      
      // Add the stop and open color picker
      const newStopIndex = this.addStop(position, color, options);
      if (newStopIndex !== -1) {
        this.openColorPicker(newStopIndex, options);
      }
      return true;
    }
    
    return false;
  }
  
  /**
   * Handle drag events
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
    
    // Always update hover state
    const hoverChanged = this.processMouseMove(x, y);
    
    // Handle dragging stops
    if (this.draggingStopIndex !== -1) {
      const position = this.getNormalizedPosition(x, y);
      
      // Create new stops array with updated position
      const newStops = [...this.value];
      newStops[this.draggingStopIndex].position = position;
      
      // Check if the stop is being dragged outside the gradient area
      const outsideGradient = !this.isOverGradient(x, y) && 
        (Math.abs(x - this.gradientRect.x) > 20 || // Allow some margin for vertical movement
        Math.abs(x - (this.gradientRect.x + this.gradientRect.width)) > 20);
      
    //   if (outsideGradient) {
    //     // Remove the stop
    //     this.removeStop(this.draggingStopIndex, options);
    //     this.draggingStopIndex = -1;
    //     node.captureInput(false);
    //   } else {
        // Update the value
        this.setValue(newStops, options);
    //   }
      
      return true;
    }
    
    // Return true if hover state changed to trigger redraw
    return hoverChanged;
  }
  
  /**
   * Add a mouse handler
   */
  onMouseMove(e: CanvasMouseEvent, localPos: [number, number], node: LGraphNode) {
    if (this.disabled) return false;
    
    // Update hover state on any mouse movement
    const hoverChanged = this.processMouseMove(localPos[0], localPos[1]);
    
    // Return true to mark the canvas as dirty and trigger a redraw if hover state changed
    return hoverChanged;
  }
  
  // Add onMouseUp handler to release capture if the node doesn't do it
  onMouseUp(e: CanvasMouseEvent, localPos: [number, number], node: LGraphNode, canvas: LGraphCanvas) {
    if (this.draggingStopIndex !== -1) {
      // Check if we only clicked (didn't really drag)
      const stopPosition = this.value[this.draggingStopIndex].position;
      const currentPosition = this.getNormalizedPosition(localPos[0], localPos[1]);
      const isDrag = Math.abs(stopPosition - currentPosition) > 0.01;
      
      // If we just clicked and didn't drag, open the color picker
      if (!isDrag) {
        this.openColorPicker(this.draggingStopIndex, {
          e,
          node,
          canvas
        });
      }
      
      this.draggingStopIndex = -1;
      node.captureInput(false);
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
    
    // Reset pending update
    pendingUpdate = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    // Make the input active
    colorInput.style.pointerEvents = "auto";
    
    // Focus and click the input to open the color picker
    setTimeout(() => {
      colorInput.focus();
      colorInput.click();
      
      // After opening, set pointer events to none
      setTimeout(() => {
        if (globalColorInput) {
          globalColorInput.style.pointerEvents = "none";
        }
      }, 100);
    }, 10);
  }
} 