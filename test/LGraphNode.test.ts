import { describe, expect, vi } from "vitest"

import { LGraphNode } from "@/litegraph"
import { NodeInputSlot, NodeOutputSlot } from "@/NodeSlot"

import { test } from "./testExtensions"

describe("LGraphNode", () => {
  test("should serialize position/size correctly", () => {
    const node = new LGraphNode("TestNode")
    node.pos = [10, 10]
    expect(node.pos).toEqual(new Float32Array([10, 10]))
    expect(node.serialize().pos).toEqual([10, 10])

    node.size = [100, 100]
    expect(node.size).toEqual(new Float32Array([100, 100]))
    expect(node.serialize().size).toEqual([100, 100])
  })

  test("should configure inputs correctly", () => {
    const node = new LGraphNode("TestNode")
    node.configure({
      id: 0,
      inputs: [{ name: "TestInput", type: "number", link: null }],
    })
    expect(node.inputs.length).toEqual(1)
    expect(node.inputs[0].name).toEqual("TestInput")
    expect(node.inputs[0].link).toEqual(null)
    expect(node.inputs[0]).instanceOf(NodeInputSlot)

    // Should not override existing inputs
    node.configure({ id: 1 })
    expect(node.id).toEqual(1)
    expect(node.inputs.length).toEqual(1)
  })

  test("should configure outputs correctly", () => {
    const node = new LGraphNode("TestNode")
    node.configure({
      id: 0,
      outputs: [{ name: "TestOutput", type: "number", links: [] }],
    })
    expect(node.outputs.length).toEqual(1)
    expect(node.outputs[0].name).toEqual("TestOutput")
    expect(node.outputs[0].type).toEqual("number")
    expect(node.outputs[0].links).toEqual([])
    expect(node.outputs[0]).instanceOf(NodeOutputSlot)

    // Should not override existing outputs
    node.configure({ id: 1 })
    expect(node.id).toEqual(1)
    expect(node.outputs.length).toEqual(1)
  })

  describe("widget inputs", () => {
    describe("dynamically added widget", () => {
      test("LGraphNode.addWidget", () => {
        const node = new LGraphNode("TestNode")
        node.addCustomWidget({
          type: "number",
          name: "TestWidget",
          value: 10,
          options: {
            slotType: "INT",
          },
        })
        expect(node.inputs.length).toEqual(1)
        expect(node.inputs[0].name).toEqual("TestWidget")
        expect(node.inputs[0].type).toEqual("INT")
        expect(node.inputs[0].link).toEqual(null)
        expect(node.inputs[0].widget?.name).toEqual("TestWidget")
        expect(node.widgets?.length).toEqual(1)
        expect(node.widgets?.[0]?.name).toEqual("TestWidget")
      })

      test("LGraphNode.addCustomWidget", () => {
        const node = new LGraphNode("TestNode")
        node.addCustomWidget({
          type: "number",
          name: "TestWidget",
          value: 10,
          options: {
            slotType: "INT",
          },
        })

        expect(node.inputs.length).toEqual(1)
        expect(node.inputs[0].name).toEqual("TestWidget")
        expect(node.inputs[0].type).toEqual("INT")
        expect(node.inputs[0].link).toEqual(null)
        expect(node.inputs[0].widget?.name).toEqual("TestWidget")
        expect(node.widgets?.length).toEqual(1)
        expect(node.widgets?.[0]?.name).toEqual("TestWidget")
      })
    })

    describe("configure", () => {
      test("should add widget input slot if widget is not already an input slot", () => {
        const node = new LGraphNode("TestNode")
        node.addCustomWidget({
          type: "number",
          name: "TestWidget",
          value: 10,
          options: {
            slotType: "INT",
          },
        })

        node.configure({
          id: 0,
          widgets_values: [10],
        })

        expect(node.inputs.length).toEqual(1)
        expect(node.inputs[0].name).toEqual("TestWidget")
        expect(node.inputs[0].type).toEqual("INT")
        expect(node.inputs[0].link).toEqual(null)
        expect(node.inputs[0].widget?.name).toEqual("TestWidget")
      })

      test("should not add widget input slot if widget is already an input slot", () => {
        const node = new LGraphNode("TestNode")
        node.addCustomWidget({
          type: "number",
          name: "TestWidget",
          value: 10,
          options: {
            slotType: "INT",
          },
        })
        node.configure({
          id: 0,
          inputs: [{ name: "TestWidget", type: "INT", link: null, widget: { name: "TestWidget" } }],
        })

        expect(node.inputs.length).toEqual(1)
        expect(node.inputs[0].name).toEqual("TestWidget")
        expect(node.inputs[0].type).toEqual("INT")
        expect(node.inputs[0].link).toEqual(null)
      })

      test("should hydrate InputSlot.widget", () => {
        const node = new LGraphNode("TestNode")
        const widget = node.addCustomWidget({
          type: "number",
          name: "TestWidget",
          value: 10,
          options: {
            slotType: "INT",
          },
        })

        node.configure({
          id: 0,
          inputs: [{ name: "TestWidget", type: "INT", link: null, widget: { name: "TestWidget" } }],
        })

        expect(node.inputs[0].widget).toBe(widget)
      })

      test("should still keep widget input slot if widget is not found", () => {
        const node = new LGraphNode("TestNode")
        const warnSpy = vi.spyOn(console, "warn")
        node.configure({
          id: 0,
          inputs: [{ name: "TestWidget", type: "INT", link: null, widget: { name: "TestWidget" } }],
        })

        expect(node.inputs.length).toEqual(1)
        expect(node.inputs[0].widget).not.toBeDefined()

        // Should be a warning console message
        expect(warnSpy).toHaveBeenCalledWith(
          "Widget with name \"TestWidget\" not found for input slot",
        )
        warnSpy.mockRestore()
      })
    })

    describe("serialize", () => {
      test("should serialize connected widget input slot", () => {
        const node = new LGraphNode("TestNode")
        node.addCustomWidget({
          type: "number",
          name: "TestWidget",
          value: 10,
          options: {
            slotType: "INT",
          },
        })

        node.inputs[0].link = 1

        const serialized = node.serialize()
        expect(serialized.inputs).toEqual([
          {
            name: "TestWidget",
            type: "INT",
            link: 1,
            widget: { name: "TestWidget" },
          },
        ])
      })

      test("should not serialize disconnected widget input slot", () => {
        const node = new LGraphNode("TestNode")
        node.addCustomWidget({
          type: "number",
          name: "TestWidget",
          value: 10,
          options: {
            slotType: "INT",
          },
        })

        const serialized = node.serialize()
        expect(serialized.inputs).toEqual([])
      })
    })
  })
})
