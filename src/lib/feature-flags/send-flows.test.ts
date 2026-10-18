import { afterEach, describe, expect, it, vi } from "vitest";
import {
	evaluateSendFlowGate,
	parseKillSwitch,
	parseNetwork,
	parseOptInFlag,
	readClientSendFlowFlags,
	readServerSendFlowFlags,
	SEND_GATE_CODES,
} from "./send-flows";

describe("parseOptInFlag", () => {
	it("only enables on explicit true/1", () => {
		expect(parseOptInFlag("true")).toBe(true);
		expect(parseOptInFlag("1")).toBe(true);
		expect(parseOptInFlag(" TRUE ")).toBe(true);
		expect(parseOptInFlag("false")).toBe(false);
		expect(parseOptInFlag("0")).toBe(false);
		expect(parseOptInFlag("yes")).toBe(false);
		expect(parseOptInFlag(undefined)).toBe(false);
	});
});

describe("parseKillSwitch", () => {
	it("fails closed on anything but unset/false/0", () => {
		expect(parseKillSwitch(undefined)).toBe(false);
		expect(parseKillSwitch("")).toBe(false);
		expect(parseKillSwitch("false")).toBe(false);
		expect(parseKillSwitch("0")).toBe(false);
		expect(parseKillSwitch("true")).toBe(true);
		expect(parseKillSwitch("typo")).toBe(true);
	});
});

describe("parseNetwork", () => {
	it("maps known networks and fails closed otherwise", () => {
		expect(parseNetwork("testnet")).toBe("testnet");
		expect(parseNetwork("futurenet")).toBe("futurenet");
		expect(parseNetwork("mainnet")).toBe("mainnet");
		expect(parseNetwork("public")).toBe("mainnet");
		expect(parseNetwork("devnet")).toBeNull();
		expect(parseNetwork(undefined)).toBeNull();
	});
});

describe("readServerSendFlowFlags", () => {
	it("reads only MUX_* variables", () => {
		const flags = readServerSendFlowFlags({
			MUX_SEND_FLOWS_ENABLED: "true",
			MUX_SEND_KILL_SWITCH: "false",
			MUX_SEND_MAINNET_ENABLED: "true",
			MUX_STELLAR_NETWORK: "mainnet",
			NEXT_PUBLIC_SEND_FLOWS_ENABLED: "false",
		});
		expect(flags.enabled).toBe(true);
		expect(flags.killSwitch).toBe(false);
		expect(flags.mainnetEnabled).toBe(true);
		expect(flags.network).toBe("mainnet");
	});

	it("ignores NEXT_PUBLIC_* variables", () => {
		const flags = readServerSendFlowFlags({
			NEXT_PUBLIC_SEND_FLOWS_ENABLED: "true",
			NEXT_PUBLIC_SEND_KILL_SWITCH: "true",
			NEXT_PUBLIC_SEND_MAINNET_ENABLED: "true",
			NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
		});
		expect(flags.enabled).toBe(false);
		expect(flags.killSwitch).toBe(false);
		expect(flags.mainnetEnabled).toBe(false);
		expect(flags.network).toBeNull();
	});
});

describe("readClientSendFlowFlags", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("ignores MUX_* variables and cannot enable sends", () => {
		vi.stubEnv("MUX_SEND_FLOWS_ENABLED", "true");
		vi.stubEnv("MUX_SEND_KILL_SWITCH", "true");
		const flags = readClientSendFlowFlags();
		expect(flags.enabled).toBe(false);
		expect(flags.killSwitch).toBe(false);
	});

	it("enables when NEXT_PUBLIC_SEND_FLOWS_ENABLED=true", () => {
		vi.stubEnv("NEXT_PUBLIC_SEND_FLOWS_ENABLED", "true");
		expect(readClientSendFlowFlags().enabled).toBe(true);
	});

	it("returns the same SendFlowFlags shape as the server reader", () => {
		expect(Object.keys(readClientSendFlowFlags()).sort()).toEqual(
			Object.keys(readServerSendFlowFlags({})).sort(),
		);
	});
});

describe("evaluateSendFlowGate", () => {
	const base = {
		enabled: true,
		killSwitch: false,
		mainnetEnabled: false,
		network: "testnet" as const,
	};

	it("allows a testnet send when enabled", () => {
		expect(evaluateSendFlowGate(base)).toEqual({
			allowed: true,
			code: SEND_GATE_CODES.OK,
			network: "testnet",
		});
	});

	it("kill switch wins over everything", () => {
		expect(
			evaluateSendFlowGate({ ...base, killSwitch: true }),
		).toEqual({ allowed: false, code: SEND_GATE_CODES.KILL_SWITCH_ENGAGED });
	});

	it("denies when disabled", () => {
		expect(evaluateSendFlowGate({ ...base, enabled: false })).toEqual({
			allowed: false,
			code: SEND_GATE_CODES.DISABLED,
		});
	});

	it("denies on unknown network", () => {
		expect(evaluateSendFlowGate({ ...base, network: null })).toEqual({
			allowed: false,
			code: SEND_GATE_CODES.NETWORK_MISCONFIGURED,
		});
	});

	it("denies mainnet without the second opt-in", () => {
		expect(evaluateSendFlowGate({ ...base, network: "mainnet" })).toEqual({
			allowed: false,
			code: SEND_GATE_CODES.MAINNET_NOT_ENABLED,
		});
	});

	it("denies a network mismatch", () => {
		expect(evaluateSendFlowGate(base, "mainnet")).toEqual({
			allowed: false,
			code: SEND_GATE_CODES.NETWORK_MISMATCH,
		});
	});
});
