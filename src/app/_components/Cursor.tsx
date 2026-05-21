import { useEffect, useRef } from "react";
import styles from "@/styles/components/cursor.module.css";

export default function Cursor() {
	const curRef = useRef<HTMLDivElement>(null);
	const ringRef = useRef<HTMLDivElement>(null);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const dotRefs = useRef<(HTMLDivElement | null)[]>([]);

	useEffect(() => {
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

		const tick = () => {
			if (curRef.current) {
				curRef.current.style.left = `${mx}px`;
				curRef.current.style.top = `${my}px`;
			}

			rafId = requestAnimationFrame(tick);
		};

		document.addEventListener("mousemove", onMove);
		rafId = requestAnimationFrame(tick);

		return () => {
			document.removeEventListener("mousemove", onMove);
			cancelAnimationFrame(rafId);
		};
	}, []);

	return (
		<>
			<div
				className={styles.cursor}
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
			/>
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
