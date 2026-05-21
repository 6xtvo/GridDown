"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import styles from "@/styles/components/nav.module.css";

export default function Nav() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<nav className="fixed top-0 inset-x-0 z-500 h-13 flex items-center justify-between px-5 md:px-10 bg-[#020202]/90 border-b border-red-600/10 backdrop-blur-[10px]">
				{/* Logo */}
				<Link
					className="flex items-center gap-2.5 no-underline text-[13px] tracking-[0.3em]"
					href="/"
				>
					<div
						className={`relative w-6.5 h-6.5 border border-red-600/50 flex items-center justify-center ${styles.navLogoMark}`}
					>
						<Image alt="GridDown Icon" height={18} src="/icon.png" width={18} />
					</div>
					<div>
						<span className="text-white">GRID</span>
						<span className="text-red-600">DOWN</span>
					</div>
				</Link>

				{/* Desktop nav links */}
				<ul className="hidden md:flex gap-7 list-none">
					{(["HOW IT WORKS", "FEATURES", "CAPABILITIES"] as const).map(
						(label, i) => (
							<li key={label}>
								<Link
									className="text-[9px] tracking-[0.28em] text-(--dim) no-underline transition-colors duration-180 hover:text-white cursor-none"
									data-slide={i + 1}
									href="#"
								>
									{label}
								</Link>
							</li>
						),
					)}
				</ul>

				{/* Desktop CTA */}
				<Link
					className="hidden md:block text-[9px] tracking-[0.28em] text-red-400 no-underline px-4 py-1.75 border border-red-600/35 bg-red-600/6 transition-all duration-180 hover:bg-red-600/13 hover:shadow-[0_0_16px_rgba(220,38,38,0.18)] cursor-none"
					href="/dashboard"
				>
					OPEN APP →
				</Link>

				{/* Mobile: CTA + hamburger */}
				<div className="flex md:hidden items-center gap-3">
					<Link
						className="text-[8px] tracking-[0.22em] text-red-400 no-underline px-3 py-1.5 border border-red-600/35 bg-red-600/6 active:bg-red-600/20 transition-all duration-180"
						href="/dashboard"
					>
						OPEN APP →
					</Link>

					{/* Hamburger button */}
					<button
						aria-label={open ? "Close menu" : "Open menu"}
						className="relative px-1.75 py-1.75 flex items-center justify-center border border-red-600/25 bg-transparent active:bg-red-600/8 transition-colors duration-150"
						onClick={() => setOpen((v) => !v)}
						type="button"
					>
						<span className="relative block w-4 h-3">
							{[{ y: 0 }, { y: 5 }, { y: 10 }].map(({ y }, i) => (
								<span
									className="absolute left-0 w-full h-px bg-red-600/70 transition-all duration-250 origin-center"
									key={i}
									style={
										open
											? i === 0
												? { top: y, transform: "translateY(5px) rotate(45deg)" }
												: i === 1
													? { top: y, opacity: 0, transform: "scaleX(0)" }
													: {
															top: y,
															transform: "translateY(-5px) rotate(-45deg)",
														}
											: { top: y }
									}
								/>
							))}
						</span>
					</button>
				</div>
			</nav>

			{/* Mobile dropdown menu */}
			<div
				className="fixed inset-x-0 z-499 md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-[#020202]/97 border-b border-red-600/10 backdrop-blur-[10px]"
				style={{
					top: "52px", // h-13 = 52px
					maxHeight: open ? "220px" : "0px",
					opacity: open ? 1 : 0,
				}}
			>
				<ul className="flex flex-col list-none px-5 pt-5 pb-6 gap-0">
					{(["HOW IT WORKS", "FEATURES", "CAPABILITIES"] as const).map(
						(label, i) => (
							<li key={label}>
								<Link
									className="flex items-center gap-3 py-3.5 text-[9px] tracking-[0.28em] text-(--dim) no-underline border-b border-red-600/8 active:text-white transition-colors duration-150"
									data-slide={i + 1}
									href="#"
									onClick={() => setOpen(false)}
								>
									<span className="text-red-600/40 text-[8px]">0{i + 1}</span>
									{label}
								</Link>
							</li>
						),
					)}
				</ul>
			</div>

			{/* Backdrop */}
			{open && (
				<div
					className="fixed inset-0 z-498 md:hidden bg-black/60 transition-opacity duration-300"
					onClick={() => setOpen(false)}
				/>
			)}
		</>
	);
}
