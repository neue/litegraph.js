import type { LGraphCanvas } from "@/LGraphCanvas"
import type { LGraphNode } from "@/LGraphNode"
import type { CanvasMouseEvent } from "@/types/events"
import type { IBaseWidget, IWidgetOptions } from "@/types/widgets"

import { BaseWidget, type DrawWidgetOptions } from "./BaseWidget"

// Define the interface for the ColorWidget
export interface IColorWidget extends IBaseWidget {
  type: "color"
  value: string
  options: IWidgetOptions<string>
}

// Global singleton color input element
let globalColorInput: HTMLInputElement | null = null;
let currentColorWidget: ColorWidget | null = null;
let currentOptions: {
  e: CanvasMouseEvent;
  node: LGraphNode;
  canvas: LGraphCanvas;
} | null = null;
let pendingUpdate = false;
let animationFrameId: number | null = null;

// Create and get the global color input
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
    
    // Handle color changes
    globalColorInput.addEventListener("input", handleColorChange);
    // Handle blur for cleanup
    globalColorInput.addEventListener("blur", hideGlobalColorInput);
    // Handle change for final value
    globalColorInput.addEventListener("change", () => {
      // Always apply the final value immediately
      if (globalColorInput && currentColorWidget && currentOptions) {
        applyColorChange();
      }
      setTimeout(hideGlobalColorInput, 100);
    });
  }
  return globalColorInput;
}

// Schedule a color update for next animation frame
function handleColorChange() {
  if (!globalColorInput || !currentColorWidget || !currentOptions) return;
  
  // Skip if value hasn't changed
  if (globalColorInput.value === currentColorWidget.value) return;
  
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

// Apply the current color change
function applyColorChange() {
  if (globalColorInput && currentColorWidget && currentOptions) {
    currentColorWidget.setValue(globalColorInput.value, currentOptions);
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
  currentColorWidget = null;
  currentOptions = null;
}

export class ColorWidget extends BaseWidget implements IColorWidget {
  // IColorWidget properties
  declare type: "color"
  declare value: string
  declare options: IWidgetOptions<string>

  constructor(widget: IColorWidget) {
    super(widget)
    this.type = "color"
    this.value = widget.value || "#ffffff"
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
    const originalTextAlign = ctx.textAlign
    const originalStrokeStyle = ctx.strokeStyle
    const originalFillStyle = ctx.fillStyle

    const { height } = this

    ctx.textAlign = "left"
    ctx.strokeStyle = this.outline_color
    ctx.fillStyle = this.background_color
    // ctx.beginPath()

    // if (show_text)
    //   ctx.roundRect(margin, y, width - margin * 2, height, [height * 0.5])
    // else
    //   ctx.rect(margin, y, width - margin * 2, height)
    // ctx.fill()

    if (show_text) {
      if (!this.disabled) ctx.stroke()

      // Draw color swatch on the right side
      ctx.save()
      ctx.fillStyle = this.value
      const swatchSize = height - 6
      const swatchX = width - margin - swatchSize - 5
      const swatchY = y + 3
      ctx.beginPath()
      ctx.roundRect(swatchX, swatchY, swatchSize, swatchSize, [4])
      ctx.fill()
      
      // Draw a border around the swatch for better visibility
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()

      // Draw label
      ctx.fillStyle = this.secondary_text_color
      const label = this.label || this.name
      if (label != null) {
        ctx.fillText(label, margin * 2, y + height * 0.7)
      }

      // Draw value
      ctx.fillStyle = this.text_color
      ctx.textAlign = "right"
      ctx.fillText(
        this.value,
        swatchX - 5,
        y + height * 0.7,
      )
    }

    // Restore original context attributes
    ctx.textAlign = originalTextAlign
    ctx.strokeStyle = originalStrokeStyle
    ctx.fillStyle = originalFillStyle
  }

  override onClick(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    if (this.options.read_only) return

    const { e, node, canvas } = options
    
    // Get the color input
    const colorInput = getGlobalColorInput();
    
    // Set current widget and options for callbacks
    currentColorWidget = this;
    currentOptions = options;
    
    // Set the current color
    colorInput.value = this.value;
    
    // Reset any pending updates
    pendingUpdate = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    // Position where the mouse is
    colorInput.style.left = `${e.clientX}px`;
    colorInput.style.top = `${e.clientY}px`;
    
    // Make the input active for the click
    colorInput.style.pointerEvents = "auto";
    
    // Focus and click the input to open the color picker
    setTimeout(() => {
      colorInput.focus();
      colorInput.click();
      
      // After a small delay to let the color picker open, disable pointer events
      // This prevents the input from blocking other interactions
      setTimeout(() => {
        if (globalColorInput) {
          globalColorInput.style.pointerEvents = "none";
        }
      }, 100);
    }, 10);
  }
} 