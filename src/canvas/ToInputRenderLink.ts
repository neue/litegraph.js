import type { RenderLink } from "./RenderLink"
import type { LinkConnectorEventTarget } from "@/infrastructure/LinkConnectorEventTarget"
import type { INodeInputSlot, INodeOutputSlot, LinkNetwork, Point } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { LLink } from "@/LLink"
import type { Reroute } from "@/Reroute"

import { LinkDirection } from "@/types/globalEnums"

/** Connecting TO an input slot. */

export class ToInputRenderLink implements RenderLink {
  readonly toType = "input"
  readonly fromPos: Point
  readonly fromSlotIndex: number
  fromDirection: LinkDirection = LinkDirection.RIGHT

  constructor(
    readonly network: LinkNetwork,
    readonly node: LGraphNode,
    readonly fromSlot: INodeOutputSlot,
    readonly fromReroute?: Reroute,
    public dragDirection: LinkDirection = LinkDirection.CENTER,
  ) {
    const outputIndex = node.outputs.indexOf(fromSlot)
    if (outputIndex === -1) throw new Error(`Creating render link for node [${this.node.id}] failed: Slot index not found.`)

    this.fromSlotIndex = outputIndex
    this.fromPos = fromReroute
      ? fromReroute.pos
      : this.node.getOutputPos(outputIndex)
  }

  canConnectToInput(inputNode: LGraphNode, input: INodeInputSlot): boolean {
    return this.node.canConnectTo(inputNode, input, this.fromSlot)
  }

  canConnectToOutput(): false {
    return false
  }

  connectToInput(node: LGraphNode, input: INodeInputSlot, events: LinkConnectorEventTarget) {
    const { node: outputNode, fromSlot, fromReroute } = this
    if (node === outputNode) return

    const newLink = outputNode.connectSlots(fromSlot, node, input, fromReroute?.id)
    events.dispatch("link-created", newLink)
  }

  connectToRerouteInput(
    reroute: Reroute,
    {
      node: inputNode,
      input,
      link,
    }: { node: LGraphNode, input: INodeInputSlot, link: LLink },
    events: LinkConnectorEventTarget,
    originalReroutes: Reroute[],
  ) {
    const { node: outputNode, fromSlot, fromReroute } = this

    // Check before creating new link overwrites the value
    const floatingTerminus = fromReroute?.floating?.slotType === "output"

    // Set the parentId of the reroute we dropped on, to the reroute we dragged from
    reroute.parentId = fromReroute?.id

    const newLink = outputNode.connectSlots(fromSlot, inputNode, input, link.parentId)

    // Connecting from the final reroute of a floating reroute chain
    if (floatingTerminus) fromReroute.removeAllFloatingLinks()

    // Clean up reroutes
    for (const reroute of originalReroutes) {
      if (reroute.id === fromReroute?.id) break

      reroute.removeLink(link)
      if (reroute.totalLinks === 0) {
        if (link.isFloating) {
          // Cannot float from both sides - remove
          reroute.remove()
        } else {
          // Convert to floating
          const cl = link.toFloating("output", reroute.id)
          this.network.addFloatingLink(cl)
          reroute.floating = { slotType: "output" }
        }
      }
    }
    events.dispatch("link-created", newLink)
  }

  connectToOutput() {
    throw new Error("ToInputRenderLink cannot connect to an output.")
  }

  connectToRerouteOutput() {
    throw new Error("ToInputRenderLink cannot connect to an output.")
  }
}
