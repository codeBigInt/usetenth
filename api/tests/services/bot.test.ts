import { describe, expect, test, vi } from "vitest";
import { copy, handleUpdate, parseArgs, parseCommand, type BotDeposit, type BotDeps, type TelegramUpdate } from "../../src/services/bot";

const from = { id: 42, first_name: "Ada", username: "ada" };
type Sent = { text: string; buttons?: { text: string; url: string }[] | { text: string; url: string } };

const deposit: BotDeposit = {
  asset: "PYUSD",
  defaultNetwork: "solana",
  networks: [
    { network: "solana", compatible: [], address: "SoLaNaAddr123", source: "wallet" },
    { network: "ethereum", compatible: ["base", "arbitrum_one"], address: null, source: null },
  ],
};

function setup(overrides: Partial<BotDeps> = {}) {
  const sent: Sent[] = [];
  const seen = new Set<number>();
  const deps: BotDeps = {
    send: async (_chat, text, buttons) => void sent.push({ text, buttons }),
    webUrl: (path) => `https://app.test${path}`,
    demo: true,
    register: vi.fn(async () => undefined),
    getPortfolio: async () => ({ cash: "50.00", value: "0.00", invested: "0.00", gain: null, holdings: [] }),
    claimUpdate: async (id) => (seen.has(id) ? false : (seen.add(id), true)),
    ...overrides,
  };
  const say = (text: string, id = Math.floor(Math.random() * 1e9)) =>
    handleUpdate({ update_id: id, message: { chat: { id: 1 }, from, text } } satisfies TelegramUpdate, deps);
  return { deps, sent, say };
}

function withCards(overrides: Partial<BotDeps> = {}) {
  const photos: { card: unknown; caption?: string; buttons?: unknown }[] = [];
  const base = setup({
    card: (spec) => Buffer.from(JSON.stringify({ spec })),
    sendPhoto: async (_c, png, caption, buttons) => {
      const { spec } = JSON.parse(png.toString());
      photos.push({ card: spec, caption, buttons });
    },
    getRule: async () => null,
    ...overrides,
  });
  return { ...base, photos };
}

describe("parseCommand", () => {
  test("extracts the command name", () => {
    expect(parseCommand("/start")).toBe("start");
    expect(parseCommand("/Tenth@usetenth_bot now")).toBe("tenth");
    expect(parseCommand("hello")).toBeNull();
    expect(parseCommand(undefined)).toBeNull();
  });
});

describe("text commands", () => {
  test("/help is a full, formatted guide", async () => {
    const { sent, say } = setup();
    await say("/help");
    expect(sent[0]?.text).toContain("<b>What I can do</b>");
    for (const c of ["/portfolio", "/tenth", "/buy", "/sell", "/deposit", "/address", "/withdraw"]) expect(sent[0]?.text).toContain(c);
  });

  test("/withdraw explains why it is off in the demo", async () => {
    const { sent, say } = setup();
    await say("/withdraw");
    expect(sent[0]?.text).toContain("Withdrawals are off in the demo");
    expect(sent[0]?.text).toContain("real funded account");
  });

  test("unknown commands point to /help; plain text is ignored", async () => {
    const { sent, say } = setup();
    await say("/nope");
    await say("just chatting");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain("/help");
  });

  test("replaying the same update three times acts once", async () => {
    const { sent, say } = setup();
    await say("/help", 7);
    await say("/help", 7);
    await say("/help", 7);
    expect(sent).toHaveLength(1);
  });

  test("a failing command apologises instead of going silent", async () => {
    const { sent, say } = setup({ getPortfolio: async () => { throw new Error("boom"); } });
    await say("/portfolio");
    expect(sent[0]?.text).toBe("Something went wrong. Please try again in a moment.");
  });

  test("without a web URL it still answers, with no button", async () => {
    const { sent, say } = setup({ webUrl: () => null });
    await say("/tenth");
    expect(sent[0]?.buttons).toBeUndefined();
  });
});

describe("copy", () => {
  test("the welcome explains the product in three steps", () => {
    const t = copy.welcome();
    expect(t).toContain("Keep a tenth of every payment");
    expect(t).toMatch(/1\. Set your tenth[\s\S]*2\. Get paid[\s\S]*3\. We invest/);
    expect(t.length).toBeLessThan(1024);
  });

  test("portfolio copy covers empty, up and down", () => {
    const base = { cash: "50.00", invested: "100.00", holdings: [{ name: "Apple", amount: "115.25" }] };
    expect(copy.portfolio({ ...base, value: "0.00", gain: null, holdings: [] })).toContain("nothing invested yet");
    expect(copy.portfolio({ ...base, value: "115.25", gain: "15.25" })).toContain("up $15.25 since you started");
    expect(copy.portfolio({ ...base, value: "95.00", gain: "-5.00" })).toContain("down $5.00 since you started");
  });

  test("tenth copy uses the saved rule, or says none is set", () => {
    expect(copy.tenth({ percent: 12, mixName: "Growth" })).toContain("12% of every payment");
    expect(copy.tenth({ percent: 12, mixName: "Growth" })).toContain("The other 88% stays yours");
    expect(copy.tenth(null)).toContain("You have not set your tenth yet");
  });

  test("a mix name cannot inject markup into the message", () => {
    expect(copy.tenth({ percent: 10, mixName: "A <b>&</b>" })).toContain("A &lt;b&gt;&amp;&lt;/b&gt;");
  });
});

describe("cards", () => {
  test("/start sends the welcome card, its caption is the full welcome", async () => {
    const { photos, sent, say } = withCards();
    await say("/start");
    expect(photos[0]?.card).toEqual({ kind: "welcome" });
    expect(photos[0]?.caption).toBe(copy.welcome());
    expect(sent).toHaveLength(0);
  });

  test("/tenth shows the saved percentage and mix, or the defaults", async () => {
    const saved = withCards({ getRule: async () => ({ percent: 12, mixName: "Growth" }) });
    await saved.say("/tenth");
    expect(saved.photos[0]?.card).toEqual({ kind: "tenth", percent: 12, mixName: "Growth" });
    const fresh = withCards();
    await fresh.say("/tenth");
    expect(fresh.photos[0]?.card).toEqual({ kind: "tenth", percent: 10, mixName: "Steady" });
  });

  test("/portfolio sends the card built from the real numbers", async () => {
    const { photos, say } = withCards({
      getPortfolio: async () => ({ cash: "50.00", value: "115.25", invested: "100.00", gain: "15.25", holdings: [{ name: "Apple", amount: "115.25" }] }),
    });
    await say("/portfolio");
    expect(photos[0]?.card).toEqual({ kind: "portfolio", worth: "115.25", gain: "15.25", invested: "100.00", cash: "50.00", holdings: [{ name: "Apple", amount: "115.25" }] });
  });

  test("a card that fails to draw falls back to the same words as text", async () => {
    const { photos, sent, say } = withCards({ card: () => { throw new Error("no font"); } });
    await say("/start");
    expect(photos).toHaveLength(0);
    expect(sent[0]?.text).toBe(copy.welcome());
  });
});

describe("deposit flow", () => {
  test("/deposit shows the address beside its network, with both CTAs", async () => {
    const { sent, say } = setup({ getDeposit: async () => deposit });
    await say("/deposit");
    const text = sent[0]!.text;
    expect(text).toContain("<code>SoLaNaAddr123</code>");
    expect(text).toContain("your wallet address on the <b>Solana</b> network");
    expect(text).toContain("Only send PYUSD on Solana");
    expect(sent[0]?.buttons).toEqual([
      { text: "Use a different network", url: "https://app.test/add-funds" },
      { text: "Add funds from a bank", url: "https://app.test/add-funds?method=bank" },
    ]);
  });

  test("a real deposit address is called that, and an unverified account is told what unlocks the rest", async () => {
    const real: BotDeposit = { asset: "PYUSD", defaultNetwork: "solana", canCreate: false, networks: [{ network: "solana", compatible: [], address: "S1", source: "deposit" }] };
    const { sent, say } = setup({ getDeposit: async () => real });
    await say("/deposit");
    expect(sent[0]?.text).toContain("to this address on the <b>Solana</b> network");
    expect(sent[0]?.text).toContain("once your account is verified");
  });

  test("an address that also accepts other networks says so", async () => {
    const eth: BotDeposit = { ...deposit, defaultNetwork: "ethereum", networks: [{ network: "ethereum", compatible: ["base", "arbitrum_one"], address: "0xabc", source: "deposit" }] };
    const { sent, say } = setup({ getDeposit: async () => eth });
    await say("/deposit");
    expect(sent[0]?.text).toContain("also accepts PYUSD sent on Base and Arbitrum");
  });

  test("/address lists only the addresses that exist, each with its network", async () => {
    const { sent, say } = setup({ getDeposit: async () => deposit });
    await say("/address");
    expect(sent[0]?.text).toContain("<b>Solana</b>, PYUSD, your wallet");
    expect(sent[0]?.text).toContain("<code>SoLaNaAddr123</code>");
    expect(sent[0]?.text).not.toContain("Ethereum");
    expect(sent[0]?.buttons).toEqual([{ text: "Use a different network", url: "https://app.test/add-funds" }]);
  });

  test("anyone but the demo owner is told it is invite-only, and sees no address", async () => {
    const { sent, say } = setup({ getDeposit: async () => null });
    await say("/deposit");
    expect(sent[0]?.text).toContain("invite-only");
    expect(sent[0]?.text).not.toContain("SoLaNaAddr123");
  });

  test("when deposits are not configured it says so rather than inventing an address", async () => {
    const { sent, say } = setup();
    await say("/deposit");
    expect(sent[0]?.text).toContain("not switched on");
  });

  test("a failed lookup apologises", async () => {
    const { sent, say } = setup({ getDeposit: async () => { throw new Error("TM down"); } });
    await say("/deposit");
    expect(sent[0]?.text).toBe("Something went wrong. Please try again in a moment.");
  });
});

describe("invites via /start", () => {
  test("parseArgs reads the deep-link payload", () => {
    expect(parseArgs("/start JUDGE2026")).toEqual(["JUDGE2026"]);
    expect(parseArgs("/start")).toEqual([]);
    expect(parseArgs("/start@usetenth_bot abc def")).toEqual(["abc", "def"]);
  });

  test("a valid code sends the welcome, then the judge guide with Try a buy when test buys are on", async () => {
    const { sent, say } = setup({ redeemInvite: async () => "granted", testBuyMaxUsd: "2" });
    await say("/start JUDGE2026");
    expect(sent[0]?.text).toBe(copy.welcome());
    expect(sent[1]?.text).toContain("You have demo access");
    expect(sent[1]?.text).toContain("up to $2");
    expect(sent[1]?.text).toContain("not a user account");
    expect(sent[1]?.buttons).toEqual([
      { text: "Open my portfolio", url: "https://app.test/portfolio" },
      { text: "Try a buy", url: "https://app.test/buy" },
    ]);
  });

  test("with test buys off, the guide does not promise a buy", async () => {
    const { sent, say } = setup({ redeemInvite: async () => "granted", testBuyMaxUsd: null });
    await say("/start JUDGE2026");
    expect(sent[1]?.text).not.toContain("Try a buy");
    expect(sent[1]?.buttons).toEqual([{ text: "Open my portfolio", url: "https://app.test/portfolio" }]);
  });

  test("an invalid code says so and unlocks nothing", async () => {
    const { sent, say } = setup({ redeemInvite: async () => "invalid" });
    await say("/start wrong");
    expect(sent[1]?.text).toContain("That invite code is not valid");
    expect(sent[1]?.text).not.toContain("You have demo access");
  });

  test("the invite is redeemed even when every message fails to send", async () => {
    const redeem = vi.fn(async () => "granted" as const);
    const { say } = setup({ redeemInvite: redeem, send: async () => { throw new Error("telegram down"); } });
    await say("/start JUDGE2026");
    expect(redeem).toHaveBeenCalledWith(from, "JUDGE2026");
  });

  test("a plain /start never redeems anything", async () => {
    const redeem = vi.fn(async () => "granted" as const);
    const { sent, say } = setup({ redeemInvite: redeem });
    await say("/start");
    expect(redeem).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
  });

  test("the invite-only message tells a stranger how to get in", () => {
    expect(copy.inviteOnly()).toContain("Ask for an invite link");
  });
});

describe("/buy and /sell", () => {
  test("/buy opens the buy screen, and says how big a buy may be", async () => {
    const { sent, say } = setup({ testBuyMaxUsd: "2", getSellable: async () => [] });
    await say("/buy");
    expect(sent[0]?.text).toContain("up to $2");
    expect(sent[0]?.buttons).toEqual([{ text: "Buy a stock", url: "https://app.test/buy" }]);
  });

  test("/buy says buying is off rather than pretending, when it is", async () => {
    const { sent, say } = setup({ testBuyMaxUsd: null, getSellable: async () => [] });
    await say("/buy");
    expect(sent[0]?.text).toContain("Buying is switched off");
  });

  test("/sell lists what the user owns, with one button per holding that deep-links to that stock", async () => {
    const items = [{ assetKey: "base:0xabc", name: "Apple", value: "1.99" }, { assetKey: "robinhood:0xdef", name: "Oracle", value: null }];
    const { sent, say } = setup({ getSellable: async () => items });
    await say("/sell");
    expect(sent[0]?.text).toContain("Apple, worth about $1.99");
    expect(sent[0]?.text).toContain("Oracle");
    expect(sent[0]?.text).toContain("at least $1.00");
    expect(sent[0]?.buttons).toEqual([
      { text: "Sell Apple", url: "https://app.test/sell?asset=base%3A0xabc" },
      { text: "Sell Oracle", url: "https://app.test/sell?asset=robinhood%3A0xdef" },
    ]);
  });

  test("/sell with nothing owned points to buying, and a stranger is told it is invite-only", async () => {
    const empty = setup({ getSellable: async () => [] });
    await empty.say("/sell");
    expect(empty.sent[0]?.text).toContain("Nothing to sell yet");
    expect(empty.sent[0]?.buttons).toEqual([{ text: "Buy a stock", url: "https://app.test/buy" }]);
    const stranger = setup({ getSellable: async () => null });
    await stranger.say("/sell");
    expect(stranger.sent[0]?.text).toContain("invite-only");
    await stranger.say("/buy");
    expect(stranger.sent[1]?.text).toContain("invite-only");
  });
});
