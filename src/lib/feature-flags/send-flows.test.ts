import { describe, expect, it } from "vitest";
import {
	SEND_GATE_CODES,
	evaluateSendFlowGate,
	type SendFlowGateInput,
} from "./send-flows";

const baseInput: SendFlowGateInput = {
	sendEnabled: true,
	killSwitchEngaged: false,
	network: "testnet",
	mainnetOptIn: false,
};

describe("evaluateSendFlowGate", () => {
	it("allows sends when enabled and configured", () => {
		const result = evaluateSendFlowGate(baseInput);
		expect(result.allowed).toBe(true);
		expect(result.code).toBe(SEND_GATE_CODES.SEND_OK);
	});

	it("blocks when the kill switch is engaged", () => {
		const result = evaluateSendFlowGate({
			...baseInput,
			killSwitchEngaged: true,
		});
		expect(result.allowed).toBe(false);
		expect(result.code).toBe(SEND_GATE_CODES.SEND_KILL_SWITCH_ENGAGED);
	});

	it("blocks when sends are disabled", () => {
		const result = evaluateSendFlowGate({ ...baseInput, sendEnabled: false });
		expect(result.allowed).toBe(false);
		expect(result.code).toBe(SEND_GATE_CODES.SEND_DISABLED);
	});

	it("blocks when the network is misconfigured", () => {
		const result = evaluateSendFlowGate({ ...baseInput, network: null });
		expect(result.allowed).toBe(false);
		expect(result.code).toBe(SEND_GATE_CODES.SEND_NETWORK_MISCONFIGURED);
	});

	it("blocks mainnet without opt-in", () => {
		const result = evaluateSendFlowGate({
			...baseInput,
			network: "mainnet",
			mainnetOptIn: false,
		});
		expect(result.allowed).toBe(false);
		expect(result.code).toBe(SEND_GATE_CODES.SEND_MAINNET_NOT_ENABLED);
	});

	it("blocks on network mismatch", () => {
		const result = evaluateSendFlowGate({
			...baseInput,
			requestedNetwork: "mainnet",
		});
		expect(result.allowed).toBe(false);
		expect(result.code).toBe(SEND_GATE_CODES.SEND_NETWORK_MISMATCH);
	});
});

describe("SEND_GATE_CODES contract", () => {
	it("exports the exact string values the e2e spec asserts against", () => {
		expect(SEND_GATE_CODES).toEqual({
			SEND_OK: "SEND_OK",
			SEND_DISABLED: "SEND_DISABLED",
			SEND_KILL_SWITCH_ENGAGED: "SEND_KILL_SWITCH_ENGAGED",
			SEND_NETWORK_MISCONFIGURED: "SEND_NETWORK_MISCONFIGURED",
			SEND_MAINNET_NOT_ENABLED: "SEND_MAINNET_NOT_ENABLED",
			SEND_NETWORK_MISMATCH: "SEND_NETWORK_MISMATCH",
		});
	});

	it("returns a code present in SEND_GATE_CODES for every branch", () => {
		const branches: SendFlowGateInput[] = [
			{ ...baseInput, killSwitchEngaged: true },
			{ ...baseInput, sendEnabled: false },
			{ ...baseInput, network: null },
			{ ...baseInput, network: "mainnet", mainnetOptIn: false },
			{ ...baseInput, requestedNetwork: "mainnet" },
			baseInput,
		];

		for (const input of branches) {
			const result = evaluateSendFlowGate(input);
			expect(Object.values(SEND_GATE_CODES)).toContain(result.code);
		}
	});
});
