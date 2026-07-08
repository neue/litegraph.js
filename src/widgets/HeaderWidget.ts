import type { LGraphNode } from "@/LGraphNode"
import type { IHeaderWidget, IWidgetOptions } from "@/types/widgets"

import { BaseWidget, type DrawWidgetOptions } from "./BaseWidget"

/**
 * Fork addition: a static header/label row. Draws a left-aligned label and a
 * right-aligned value with no background capsule; ignores clicks.
 */
export class HeaderWidget extends BaseWidget<IHeaderWidget> implements IHeaderWidget {
  declare type: "header"
  declare options: IWidgetOptions<string>

  constructor(widget: IHeaderWidget, node?: LGraphNode) {
    super(widget, node as LGraphNode)
    this.type = "header"
    this.value = widget.value?.toString() ?? ""
  }

  override drawWidget(ctx: CanvasRenderingContext2D, { width, showText = true }: DrawWidgetOptions) {
    // Store original context attributes
    const originalTextAlign = ctx.textAlign
    const originalFillStyle = ctx.fillStyle

    const { height, y } = this
    const { margin } = BaseWidget

    if (showText) {
      ctx.save()
      // Draw label
      ctx.textAlign = "left"
      ctx.fillStyle = this.secondary_text_color
      const label = this.displayName
      if (label != null) {
        ctx.fillText(label, margin, y + height * 0.7)
      }

      // Draw value
      ctx.fillStyle = this.text_color
      ctx.textAlign = "right"
      ctx.fillText(
        // 30 chars max
        String(this.value).slice(0, 30),
        width - margin * 2,
        y + height * 0.7,
      )
      ctx.restore()
    }

    // Restore original context attributes
    ctx.textAlign = originalTextAlign
    ctx.fillStyle = originalFillStyle
  }

  override onClick() {}
}
