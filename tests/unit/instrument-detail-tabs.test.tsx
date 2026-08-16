import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { InstrumentDetailTabs } from "@/components/research/InstrumentDetailTabs";

const tabs = [
  { id: "overview", label: "概要", content: <p>概要内容</p> },
  { id: "outlook", label: "見通し", content: <p>見通し内容</p> },
  { id: "chart", label: "チャート・需給", content: <p>チャート内容</p> },
] as const;

function renderTabs() {
  render(<InstrumentDetailTabs tabs={tabs} />);
}

it("switches from overview to the plain-language outlook tab", () => {
  render(
    <InstrumentDetailTabs
      tabs={[
        { id: "overview", label: "概要", content: <p>概要内容</p> },
        { id: "outlook", label: "見通し", content: <p>期待できる材料</p> },
      ]}
    />
  );
  fireEvent.click(screen.getByRole("tab", { name: "見通し" }));
  expect(screen.getByText("期待できる材料")).toBeVisible();
  expect(screen.getByRole("tab", { name: "見通し" })).toHaveAttribute("aria-selected", "true");
});

it("moves selection and focus with the right arrow key", () => {
  render(
    <InstrumentDetailTabs
      tabs={[
        { id: "overview", label: "概要", content: <p>概要内容</p> },
        { id: "outlook", label: "見通し", content: <p>見通し内容</p> },
      ]}
    />
  );

  const overviewTab = screen.getByRole("tab", { name: "概要" });
  overviewTab.focus();
  fireEvent.keyDown(overviewTab, { key: "ArrowRight" });

  const outlookTab = screen.getByRole("tab", { name: "見通し" });
  expect(outlookTab).toHaveFocus();
  expect(outlookTab).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("見通し内容")).toBeVisible();
});

it("wraps from the first tab to the last tab with the left arrow key", () => {
  renderTabs();

  const overviewTab = screen.getByRole("tab", { name: "概要" });
  overviewTab.focus();
  fireEvent.keyDown(overviewTab, { key: "ArrowLeft" });

  const chartTab = screen.getByRole("tab", { name: "チャート・需給" });
  expect(chartTab).toHaveFocus();
  expect(chartTab).toHaveAttribute("aria-selected", "true");
});

it("wraps from the last tab to the first tab with the right arrow key", () => {
  renderTabs();

  const chartTab = screen.getByRole("tab", { name: "チャート・需給" });
  fireEvent.click(chartTab);
  chartTab.focus();
  fireEvent.keyDown(chartTab, { key: "ArrowRight" });

  const overviewTab = screen.getByRole("tab", { name: "概要" });
  expect(overviewTab).toHaveFocus();
  expect(overviewTab).toHaveAttribute("aria-selected", "true");
});

it("keeps only the selected tab in the page tab order", () => {
  renderTabs();

  const overviewTab = screen.getByRole("tab", { name: "概要" });
  const outlookTab = screen.getByRole("tab", { name: "見通し" });
  const chartTab = screen.getByRole("tab", { name: "チャート・需給" });

  expect(overviewTab).toHaveAttribute("tabindex", "0");
  expect(outlookTab).toHaveAttribute("tabindex", "-1");
  expect(chartTab).toHaveAttribute("tabindex", "-1");

  fireEvent.click(outlookTab);

  expect(overviewTab).toHaveAttribute("tabindex", "-1");
  expect(outlookTab).toHaveAttribute("tabindex", "0");
  expect(chartTab).toHaveAttribute("tabindex", "-1");
});

it("links each tab to its stable labelled panel", () => {
  renderTabs();

  for (const tab of screen.getAllByRole("tab")) {
    const panelId = tab.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();

    const panel = document.getElementById(panelId!);
    expect(panel).toHaveAttribute("role", "tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  }
});
