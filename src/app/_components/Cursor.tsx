"use client";

import { useCallback, useEffect, useRef } from "react";

export default function Cursor() {
	const curRef = useRef<HTMLDivElement>(null);
	const ringRef = useRef<HTMLDivElement>(null);
	const isTouchDevice = useRef(false);

	// Spawn a click ripple at (x, y)
	const spawnRipple = useCallback((x: number, y: number) => {
		const ripple = document.createElement("div");
		ripple.style.cssText = `
			position: fixed;
			pointer-events: none;
			z-index: 9997;
			left: ${x}px;
			top: ${y}px;
			width: 0;
			height: 0;
			transform: translate(-50%, -50%);
			border: 1px solid rgba(220,38,38,0.7);
			border-radius: 50%;
			animation: cursorRipple 0.55s cubic-bezier(0.2,0.8,0.4,1) forwards;
		`;
		document.body.appendChild(ripple);
		ripple.addEventListener("animationend", () => ripple.remove());
	}, []);

	useEffect(() => {
		// Inject keyframes once
		if (!document.getElementById("cursor-ripple-style")) {
			const style = document.createElement("style");
			style.id = "cursor-ripple-style";
			style.textContent = `
				@keyframes cursorRipple {
					0%   { width: 0px; height: 0px; opacity: 1; border-color: rgba(220,38,38,0.75); }
					60%  { opacity: 0.6; }
					100% { width: 72px; height: 72px; opacity: 0; border-color: rgba(220,38,38,0); }
				}
				@keyframes cursorSqueeze {
					0%   { transform: translate(-50%,-50%) scale(1); }
					35%  { transform: translate(-50%,-50%) scale(0.55); border-color: rgba(220,38,38,0.95); }
					100% { transform: translate(-50%,-50%) scale(1); }
				}
				@keyframes cursorRingSqueeze {
					0%   { transform: translate(-50%,-50%) scale(1); opacity: 1; }
					35%  { transform: translate(-50%,-50%) scale(0.7); opacity: 0.5; }
					100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
				}
			`;
			document.head.appendChild(style);
		}

		// Detect touch — hide cursor on touch-primary devices
		const onFirstTouch = () => {
			isTouchDevice.current = true;
			if (curRef.current) curRef.current.style.display = "none";
			if (ringRef.current) ringRef.current.style.display = "none";
		};
		window.addEventListener("touchstart", onFirstTouch, { once: true });

		let rafId: number;
		let mx = -300;
		let my = -300;

		const onMove = (e: MouseEvent) => {
			mx = e.clientX;
			my = e.clientY;
			if (ringRef.current) {
				ringRef.current.style.left = `${mx}px`;
				ringRef.current.style.top = `${my}px`;
			}
		};

		const onMouseDown = (e: MouseEvent) => {
			if (isTouchDevice.current) return;
			spawnRipple(e.clientX, e.clientY);

			if (curRef.current) {
				curRef.current.style.animation = "none";
				void curRef.current.offsetHeight; // reflow
				curRef.current.style.animation =
					"cursorSqueeze 0.35s cubic-bezier(0.2,0.8,0.4,1) forwards";
			}
			if (ringRef.current) {
				ringRef.current.style.animation = "none";
				void ringRef.current.offsetHeight;
				ringRef.current.style.animation =
					"cursorRingSqueeze 0.35s cubic-bezier(0.2,0.8,0.4,1) forwards";
			}
		};

		const onMouseUp = () => {
			if (curRef.current) curRef.current.style.animation = "";
			if (ringRef.current) ringRef.current.style.animation = "";
		};

		const tick = () => {
			if (curRef.current) {
				curRef.current.style.left = `${mx}px`;
				curRef.current.style.top = `${my}px`;
			}
			rafId = requestAnimationFrame(tick);
		};

		document.addEventListener("mousemove", onMove);
		document.addEventListener("mousedown", onMouseDown);
		document.addEventListener("mouseup", onMouseUp);
		rafId = requestAnimationFrame(tick);

		return () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mousedown", onMouseDown);
			document.removeEventListener("mouseup", onMouseUp);
			window.removeEventListener("touchstart", onFirstTouch);
			cancelAnimationFrame(rafId);
		};
	}, [spawnRipple]);

	return (
		<>
			{/* Square cursor with crosshair plus */}
			<div
				ref={curRef}
				style={{
					position: "fixed",
					pointerEvents: "none",
					zIndex: 9999,
					width: 18,
					height: 18,
					left: -300,
					top: -300,
					transform: "translate(-50%, -50%)",
					border: "1px solid var(--red)",
				}}
			>
				{/* Horizontal bar of the plus */}
				<div
					style={{
						position: "absolute",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						width: 7,
						height: 1,
						backgroundColor: "var(--red)",
					}}
				/>
				{/* Vertical bar of the plus */}
				<div
					style={{
						position: "absolute",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						width: 1,
						height: 7,
						backgroundColor: "var(--red)",
					}}
				/>
			</div>
			<div
				ref={ringRef}
				style={{
					position: "fixed",
					pointerEvents: "none",
					zIndex: 9998,
					width: 36,
					height: 36,
					left: -300,
					top: -300,
					transform: "translate(-50%, -50%)",
					border: "1px solid rgba(220,38,38,0.18)",
					borderRadius: "50%",
					transition: "left 0.11s ease-out, top 0.11s ease-out",
				}}
			/>
		</>
	);
}
