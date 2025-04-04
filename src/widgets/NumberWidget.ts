import type { LGraphCanvas } from "@/LGraphCanvas"
import type { LGraphNode } from "@/LGraphNode"
import type { CanvasMouseEvent } from "@/types/events"
import type { INumericWidget, IWidgetOptions } from "@/types/widgets"

import { getWidgetStep } from "@/utils/widget"

import { BaseWidget, type DrawWidgetOptions } from "./BaseWidget"

export class NumberWidget extends BaseWidget implements INumericWidget {
  // INumberWidget properties
  declare type: "number"
  declare value: number
  declare options: IWidgetOptions<number>

  constructor(widget: INumericWidget) {
    super(widget)
    this.type = "number"
    this.value = widget.value
  }

  override setValue(value: number, options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    console.log("WIDGET_VALUE_SET", value, this.options);
    let newValue = value

    if (this.options?.round) {
      newValue = Math.round(newValue / (this.options.round as number)) * (this.options.round as number);      
    }

    if (this.options.min != null && newValue < this.options.min) {
      newValue = this.options.min
    }
    if (this.options.max != null && newValue > this.options.max) {
      newValue = this.options.max
    }
    
    super.setValue(newValue, options)
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
    ctx.beginPath()

    // if (show_text)
    //   ctx.roundRect(margin, y, width - margin * 2, height, [height * 0.5])
    // else
    //   ctx.rect(margin, y, width - margin * 2, height)
    // ctx.fill()

    if (show_text) {
      if (!this.disabled) {
        ctx.stroke()
        // Draw left arrow
        ctx.fillStyle = this.text_color
        ctx.beginPath()
        ctx.moveTo(margin + 10, y + 5)
        ctx.lineTo(margin + 6, y + height * 0.5)
        ctx.lineTo(margin + 10, y + height - 5)
        ctx.fill()
        // Draw right arrow
        ctx.beginPath()
        ctx.moveTo(width - margin - 10, y + 5)
        ctx.lineTo(width - margin - 6, y + height * 0.5)
        ctx.lineTo(width - margin - 10, y + height - 5)
        ctx.fill()
      }

      // Draw label
      ctx.fillStyle = this.secondary_text_color
      const label = this.label || this.name
      if (label != null) {
        ctx.fillText(label, margin * 2 + 5, y + height * 0.7)
      }

      // Draw value
      ctx.fillStyle = this.text_color
      ctx.textAlign = "right"
      let formatted: string;
      if (this.options.round !== undefined && this.options.round !== null) {
        // Convert round to a string, then count decimals
        const roundString = this.options.round.toString();
        const decimalPart = roundString.split('.')[1];
        const precision = decimalPart ? decimalPart.length : 0;
        formatted = Number(this.value).toFixed(precision);
      } else {
        // Default behavior with 3 decimals
        formatted = Number(this.value).toFixed(3);
      }
      ctx.fillText(
        formatted,
        width - margin * 2 - 20,
        y + height * 0.7,
      );
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
    const { e, node, canvas } = options
    const x = e.canvasX - node.pos[0]
    const width = this.width || node.size[0]

    // Determine if clicked on left/right arrows
    const delta = x < 40
      ? -1
      : (x > width - 40
        ? 1
        : 0)

    if (delta) {
      // Handle left/right arrow clicks
      this.setValue(this.value + delta * getWidgetStep(this.options), { e, node, canvas })
      return
    }

    // Handle center click - show prompt
    canvas.prompt("Value", this.value, (v: string) => {
      // Check if v is a valid equation or a number
      if (/^[\d\s()*+/-]+|\d+\.\d+$/.test(v)) {
        // Solve the equation if possible
        try {
          v = eval(v)
        } catch {}
      }
      const newValue = Number(v)
      if (!isNaN(newValue)) {
        this.setValue(newValue, { e, node, canvas })
      }
    }, e)
  }

  /**
   * Handles drag events for the number widget
   * @param options The options for handling the drag event
   */
  override onDrag(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    const { e, node, canvas } = options
    const width = this.width || node.width
    const x = e.canvasX - node.pos[0]
    const delta = x < 40
      ? -1
      : (x > width - 40
        ? 1
        : 0)

    if (delta && (x > -3 && x < width + 3)) return
    this.setValue(this.value + (e.deltaX ?? 0) * getWidgetStep(this.options), { e, node, canvas })
  }
}
