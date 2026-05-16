// P2P Types - shared across server and client

export interface PeerInfo {
	peerId: string;
	ip: string;
	port?: number;
	metadata?: Record<string, unknown>;
	lastSeen: number;
}

export interface WebRTCSignal {
	id?: string;
	from: string;
	to: string;
	type: "offer" | "answer" | "ice-candidate";
	data: Record<string, unknown>;
	timestamp: number;
}

export interface P2PMessage {
	id?: string;
	from: string;
	type: string;
	data: unknown;
	timestamp: number;
}
