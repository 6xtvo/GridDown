// P2P WebRTC Application - Types and Interfaces

export interface PeerInfo {
	peerId: string;
	ip: string;
	port?: number;
	metadata?: Record<string, unknown>;
	lastSeen: number;
}

export interface WebRTCSignal {
	from: string;
	to: string;
	type: "offer" | "answer" | "ice-candidate";
	data: Record<string, unknown>;
	timestamp: number;
}

export interface P2PMessage {
	from: string;
	type: string;
	data: unknown;
	timestamp: number;
}
