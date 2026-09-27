import { describe, expect, test } from "vitest";
import { cardSvg, paymentCardSpec, renderCard, type CardSpec } from "../../src/services/cards";

const PNG = [0x89, 0x50, 0x4e, 0x47];
const dims = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });

const portfolio = (holdings: number, gain: string | null = "11.04"): CardSpec => ({
  kind: "portfolio", worth: "331.04", gain, invested: "320.00", cash: "50.00",
  holdings: Array.from({ length: holdings }, (_, i) => ({ name: `Stock ${i}`, amount: "10.00" })),
});

describe("renderCard", () => {
  test("every card is a 1080px-wide PNG", () => {
    const specs: CardSpec[] = [
      { kind: "welcome" },
      { kind: "tenth", percent: 10, mixName: "Steady" },
      portfolio(2),
      paymentCardSpec({ amount: "800.00", investmentAmount: "80.00", bought: [{ name: "Apple", amount: "40.00" }] }),
    ];
    for (const spec of specs) {
      const png = renderCard(spec);
      expect([...png.subarray(0, 4)]).toEqual(PNG);
      expect(dims(png).w).toBe(1080);
    }
  });

  test("the portfolio card grows for a third row and never overflows", () => {
    expect(dims(renderCard(portfolio(2))).h).toBe(680);
    expect(dims(renderCard(portfolio(3))).h).toBe(724);
    expect(dims(renderCard(portfolio(9))).h).toBe(724);
    expect(cardSvg(portfolio(9))).toContain("and 7 more");
  });

  test("the payment card drops the Bought section when nothing was bought", () => {
    const none = paymentCardSpec({ amount: "20.00", investmentAmount: "2.00", bought: [] });
    expect(dims(renderCard(none)).h).toBe(560);
    expect(cardSvg(none)).not.toContain("Bought");
  });

  test("text is escaped so a company name cannot break the card", () => {
    const svg = cardSvg({ kind: "tenth", percent: 10, mixName: "A & B <x>" });
    expect(svg).toContain("A &amp; B &lt;x&gt;");
    expect(() => renderCard({ kind: "tenth", percent: 10, mixName: "A & B <x>" })).not.toThrow();
  });

  test("gain is green when up, red when down, and absent with nothing invested", () => {
    expect(cardSvg(portfolio(1, "11.04"))).toContain("+$11.04 since you started");
    expect(cardSvg(portfolio(1, "-45.10"))).toContain("-$45.10 since you started");
    expect(cardSvg({ ...portfolio(0, null) } as CardSpec)).toContain("Nothing invested yet");
  });

  test("cards are drawn in the light palette", () => {
    const spec: CardSpec = { kind: "tenth", percent: 10, mixName: "Steady" };
    expect(cardSvg(spec)).toContain("#FFFFFF");
    expect(cardSvg(spec)).not.toContain("#151827");
    expect([...renderCard(spec).subarray(0, 4)]).toEqual(PNG);
  });

  test("the art is there: coins, candlesticks and one violet coin per tenth", () => {
    const svg = cardSvg({ kind: "tenth", percent: 30, mixName: "Steady" });
    expect(svg).toContain("goldSide");
    expect((svg.match(/fill="url\(#vioTop\)"/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(svg).toContain("#5EF0B0");
  });

  test("payment amounts are worked out in cents: kept is amount minus invested", () => {
    expect(paymentCardSpec({ amount: "33.33", investmentAmount: "3.33", bought: [] })).toMatchObject({ kept: "30.00" });
  });
});
