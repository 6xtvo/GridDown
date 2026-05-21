"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Cursor from "@/app/_components/Cursor";
import Footer from "@/app/_components/Footer";
import Nav from "@/app/_components/Nav";
import SectionLabel from "@/app/_components/SectionLabel";
import { DELAYS, FEATURES, SKILLS } from "@/lib/constants";
import s from "@/styles/pages/home.module.css";

const STEPS = [
	{
		n: "01",
		name: "CREATE PROFILE",
		desc: "Set your name and skills, then click the map to pin your location.",
		icon: (
			<svg
				fill="none"
				height="14"
				stroke="#dc2626"
				strokeLinecap="round"
				strokeWidth="1.5"
				viewBox="0 0 24 24"
				width="14"
			>
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		),
	},
	{
		n: "02",
		name: "OVERVIEW MAP",
		desc: "Click any report in the feed or tap a map pin to get directions and an ETA from your location.",
		icon: (
			<svg
				fill="none"
				height="14"
				stroke="#dc2626"
				strokeLinecap="round"
				strokeWidth="1.5"
				viewBox="0 0 24 24"
				width="14"
			>
				<circle cx="12" cy="12" r="10" />
				<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
			</svg>
		),
	},
	{
		n: "03",
		name: "POST",
		desc: "Click the map to pin a location, then post a Need, Offer, or Update to everyone connected.",
		icon: (
			<svg
				fill="none"
				height="14"
				stroke="#dc2626"
				strokeLinecap="round"
				strokeWidth="1.5"
				viewBox="0 0 24 24"
				width="14"
			>
				<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
				<circle cx="12" cy="10" r="3" />
			</svg>
		),
	},
	{
		n: "04",
		name: "CHAT",
		desc: "Tap any report in the feed to open its chat. Send messages and photos to coordinate with others nearby.",
		icon: (
			<svg
				fill="none"
				height="14"
				stroke="#dc2626"
				strokeLinecap="round"
				strokeWidth="1.5"
				viewBox="0 0 24 24"
				width="14"
			>
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			</svg>
		),
	},
];

const rv = (n: number) =>
	`opacity-0 translate-y-[18px] transition-[opacity,transform] duration-[550ms] ease-out ${DELAYS[n]}`;

const CARD: React.CSSProperties = {
	border: "1px solid var(--faint)",
	background: "rgba(8,2,2,0.5)",
};

export default function HomePage() {
	const scrollerRef = useRef<HTMLDivElement>(null);
	const dotRefs = useRef<(HTMLDivElement | null)[]>([]);

	useEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;

		const slides = Array.from(
			scroller.querySelectorAll<HTMLElement>("[data-slide-panel]"),
		);
		const dots = dotRefs.current;

		const setActiveDot = (idx: number) => {
			dots.forEach((d, i) => {
				if (!d) return;
				const active = i === idx;
				d.style.backgroundColor = active ? "#dc2626" : "transparent";
				d.style.borderColor = active ? "#dc2626" : "rgba(220,38,38,0.35)";
				d.style.height = active ? "48px" : "30px";
				d.style.width = "7px";
			});
		};

		slides[0]?.querySelectorAll<HTMLElement>("[data-rv]").forEach((el) => {
			el.classList.remove("opacity-0", "translate-y-[18px]");
			el.classList.add("opacity-100", "translate-y-0");
		});
		setActiveDot(0);

		const goTo = (i: number) =>
			slides[i]?.scrollIntoView({ behavior: "smooth" });

		const dotHandlers = dots.map((d, i) => {
			const h = () => goTo(i);
			d?.addEventListener("click", h);
			return h;
		});

		const navHandlers: Array<{ el: HTMLElement; h: (e: Event) => void }> = [];
		document.querySelectorAll<HTMLElement>("[data-slide]").forEach((el) => {
			const h = (e: Event) => {
				e.preventDefault();
				goTo(Number(el.dataset.slide));
			};
			el.addEventListener("click", h);
			navHandlers.push({ el, h });
		});

		const io = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;
					const idx = slides.indexOf(entry.target as HTMLElement);
					setActiveDot(idx);
					entry.target
						.querySelectorAll<HTMLElement>("[data-rv]")
						.forEach((el) => {
							el.classList.remove("opacity-0", "translate-y-[18px]");
							el.classList.add("opacity-100", "translate-y-0");
						});
				});
			},
			{ root: scroller, threshold: 0.5 },
		);

		slides.forEach((sl) => io.observe(sl));
		return () => {
			io.disconnect();
			dots.forEach((d, i) => d?.removeEventListener("click", dotHandlers[i]!));
			navHandlers.forEach(({ el, h }) => el.removeEventListener("click", h));
		};
	}, []);

	return (
		<>
			<Cursor />

			<div
				className={`relative h-screen overflow-hidden bg-(--bg) text-(--text) cursor-none ${s.scanlines} ${s.bgGrid}`}
			>
				<Nav />

				{/* ── Side bar nav dots — hidden on mobile ── */}
				<div className="hidden md:flex fixed right-6 top-1/2 -translate-y-1/2 z-400 flex-col gap-3 items-center">
					{[0, 1, 2, 3, 4].map((i) => (
						<div
							className="cursor-none"
							key={i}
							ref={(el) => {
								dotRefs.current[i] = el;
							}}
							style={{
								width: 7,
								height: i === 0 ? 48 : 30,
								backgroundColor: i === 0 ? "#dc2626" : "transparent",
								border: "1px solid",
								borderColor: i === 0 ? "#dc2626" : "rgba(220,38,38,0.35)",
								transition:
									"width 0.3s cubic-bezier(0.4,0,0.2,1), height 0.3s cubic-bezier(0.4,0,0.2,1), background-color 0.2s ease, border-color 0.2s ease",
							}}
						/>
					))}
				</div>

				{/* ── Scroller ── */}
				<div
					className={`h-screen overflow-y-scroll overflow-x-hidden [scroll-snap-type:y_mandatory] scroll-smooth [-ms-overflow-style:none] scrollbar-none ${s.scroller}`}
					ref={scrollerRef}
				>
					{/* ────────────────── HERO ────────────────── */}
					<section
						className="h-screen snap-start snap-always relative flex flex-col items-center justify-center text-center pt-13 overflow-hidden"
						data-slide-panel
					>
						<div className="absolute inset-0 pointer-events-none z-1 flex items-center justify-center">
							{[0, 1, 2, 3].map((i) => (
								<div
									className={`absolute rounded-full border border-red-600/5.5 ${s.hring}`}
									key={i}
								/>
							))}
						</div>
						<div
							className={`absolute pointer-events-none z-1 w-175 h-175 rounded-full overflow-hidden ${s.heroSweep}`}
						/>
						<div
							className={`absolute pointer-events-none z-1 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${s.heroCross}`}
						/>
						<div className="absolute inset-0 pointer-events-none z-2 bg-[radial-gradient(ellipse_at_50%_50%,transparent_25%,rgba(2,2,2,0.88)_100%)]" />

						<div
							className={`relative z-10 flex flex-col items-center gap-6 md:gap-8 px-6 ${s.heroContent}`}
						>
							<div
								className={`text-[8px] tracking-[0.45em] text-red-600 flex items-center gap-2 ${s.heroEyebrow}`}
							>
								EMERGENCY COORDINATION
							</div>
							<h1 className="text-[clamp(52px,16vw,128px)] tracking-[0.12em] leading-[0.9] text-white">
								GRID<span className="text-red-600">DOWN</span>
							</h1>
							<p className="text-[10px] tracking-[0.22em] text-(--dim) max-w-[280px] md:max-w-115 leading-loose">
								A peer-to-peer coordination tool for when
								<br className="hidden md:block" /> conventional infrastructure
								has failed.
							</p>
							<div className="flex gap-3 md:gap-4 mt-2 flex-wrap justify-center">
								<Link
									className="text-[9px] tracking-[0.28em] px-6 md:px-7 py-3.25 text-red-300 no-underline border border-red-600/40 bg-red-600/8 transition-all duration-180 active:bg-red-600/25 hover:bg-red-600/17 hover:shadow-[0_0_24px_rgba(220,38,38,0.2)] cursor-none"
									href="/dashboard"
								>
									OPEN APP →
								</Link>
								<Link
									className="text-[9px] tracking-[0.28em] px-6 md:px-7 py-3.25 text-(--dim) no-underline border border-(--faint) bg-transparent transition-all duration-180 hover:text-white hover:border-white/20 active:text-white cursor-none"
									href="https://github.com/6xtvo/GridDown"
									rel="noreferrer"
									target="_blank"
								>
									VIEW SOURCE
								</Link>
							</div>
						</div>

						<div
							className={`absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-10 opacity-0 ${s.scrollHint}`}
						>
							<span className="text-[7px] tracking-[0.5em] text-(--faint)">
								SCROLL
							</span>
							<div
								className={`w-px h-8 bg-linear-to-b from-red-600/50 to-transparent ${s.scrollLine}`}
							/>
						</div>
					</section>

					{/* ────────────────── HOW IT WORKS ────────────────── */}
					<section
						className="min-h-screen snap-start snap-always relative flex flex-col justify-center pt-13 overflow-hidden"
						data-slide-panel
					>
						<div className="max-w-300 w-full mx-auto px-6 md:px-20 py-10 md:py-0 flex flex-col justify-center gap-8 md:gap-12">
							<div>
								<SectionLabel className={rv(1)} data-rv label="HOW IT WORKS" />
								<h2
									className={`text-[clamp(22px,5vw,42px)] tracking-[0.12em] text-white leading-[1.1] mt-3 ${rv(2)}`}
									data-rv
								>
									FOUR STEPS TO <span className="text-red-600">COORDINATE</span>
								</h2>
							</div>
							{/* 1 col on mobile, 2 on sm, 4 on lg */}
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
								{STEPS.map(({ n, name, desc, icon }, i) => (
									<div
										className={`group p-6 md:p-8 transition-[border-color,background] duration-250 hover:bg-red-600/2.5 active:bg-red-600/5 ${rv(i + 3)} ${s.step}`}
										data-rv
										key={n}
										onMouseEnter={(e) =>
											(e.currentTarget.style.borderColor = "var(--red-border)")
										}
										onMouseLeave={(e) =>
											(e.currentTarget.style.borderColor = "var(--faint)")
										}
										style={{ ...CARD }}
									>
										<div
											className={`text-[40px] leading-none mb-5 transition-colors duration-250 ${s.stepNumber}`}
											style={{ color: "var(--dim)" }}
										>
											{n}
										</div>
										<div className="w-7.5 h-7.5 mb-5 border border-red-600/18 flex items-center justify-center">
											{icon}
										</div>
										<div className="text-[10px] tracking-[0.25em] text-(--text) mb-3">
											{name}
										</div>
										<div className="text-[9px] tracking-[0.12em] text-(--dim) leading-loose">
											{desc}
										</div>
									</div>
								))}
							</div>
						</div>
					</section>

					{/* ────────────────── FEATURES ────────────────── */}
					<section
						className="min-h-screen snap-start snap-always relative flex flex-col justify-center pt-13 overflow-hidden"
						data-slide-panel
					>
						<div className="max-w-300 w-full mx-auto px-6 md:px-20 py-10 md:py-0 flex flex-col justify-center gap-8 md:gap-12">
							<div>
								<SectionLabel className={rv(1)} data-rv label="FEATURES" />
								<h2
									className={`text-[clamp(22px,5vw,42px)] tracking-[0.12em] text-white leading-[1.1] mt-3 ${rv(2)}`}
									data-rv
								>
									WHAT&apos;S <span className="text-red-600">INSIDE</span>
								</h2>
							</div>

							{/* 1 col mobile, 2 col sm+ */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								{FEATURES.map(
									({ tag, tagColor, tagBorder, tagBg, title, desc }, i) => (
										<div
											className={`p-6 md:p-8 flex flex-col ${rv(i + 3)}`}
											data-rv
											key={tag}
											onMouseEnter={(e) =>
												(e.currentTarget.style.borderColor =
													"var(--red-border)")
											}
											onMouseLeave={(e) =>
												(e.currentTarget.style.borderColor = "var(--faint)")
											}
											style={{ ...CARD }}
										>
											<div
												style={{
													display: "inline-flex",
													alignSelf: "flex-start",
													alignItems: "center",
													gap: 6,
													fontSize: 7,
													letterSpacing: "0.35em",
													padding: "3px 9px",
													marginBottom: 16,
													border: `1px solid ${tagBorder}`,
													color: tagColor,
													background: tagBg,
												}}
											>
												{tag}
											</div>
											<div className="text-[15px] tracking-[0.12em] text-(--text) mb-3 leading-tight">
												{title}
											</div>
											<div className="text-[9px] tracking-[0.12em] text-(--dim) leading-loose">
												{desc}
											</div>
										</div>
									),
								)}
							</div>
						</div>
					</section>

					{/* ────────────────── SKILLS ────────────────── */}
					<section
						className="min-h-screen snap-start snap-always relative flex flex-col justify-center pt-13 overflow-hidden"
						data-slide-panel
					>
						<div className="max-w-300 w-full mx-auto px-6 md:px-20 py-10 md:py-0 flex flex-col justify-center gap-8 md:gap-12">
							<div>
								<SectionLabel
									className={rv(1)}
									data-rv
									label="SKILL REGISTRY"
								/>
								<h2
									className={`text-[clamp(22px,5vw,42px)] tracking-[0.12em] text-white leading-[1.1] mt-3 ${rv(2)}`}
									data-rv
								>
									REGISTER YOUR{" "}
									<span className="text-red-600">CAPABILITIES</span>
								</h2>
								<p
									className={`text-[9px] tracking-[0.18em] text-(--dim) leading-loose mt-3 ${rv(3)}`}
									data-rv
								>
									Tag your profile with what you can offer. People posting needs
									can filter by skill to find the right person fast.
								</p>
							</div>
							{/* 2 col mobile, 3 col sm, 5 col lg */}
							<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
								{SKILLS.map((skill, i) => (
									<div
										className={`relative overflow-hidden px-3.5 py-3 text-[8px] tracking-[0.2em] text-(--dim) transition-[color,background,border-color] duration-180 hover:text-(--text) hover:bg-red-600/3 active:bg-red-600/5 cursor-default ${rv(i + 4)} ${s.sk}`}
										data-rv
										key={skill}
										onMouseEnter={(e) =>
											(e.currentTarget.style.borderColor = "var(--red-border)")
										}
										onMouseLeave={(e) =>
											(e.currentTarget.style.borderColor = "var(--faint)")
										}
										style={{
											border: "1px solid var(--faint)",
											background: "rgba(8,2,2,0.4)",
										}}
									>
										{skill}
									</div>
								))}
							</div>
						</div>
					</section>

					{/* ────────────────── CTA ────────────────── */}
					<section
						className="h-screen snap-start snap-always relative flex flex-col items-center justify-center text-center pt-13 overflow-hidden"
						data-slide-panel
					>
						<div className="absolute inset-0 pointer-events-none z-1 flex items-center justify-center opacity-50">
							{[0, 1, 2, 3].map((i) => (
								<div
									className={`absolute rounded-full border border-red-600/5.5 ${s.hring}`}
									key={i}
								/>
							))}
						</div>
						<div
							className={`absolute pointer-events-none z-1 w-175 h-175 rounded-full overflow-hidden opacity-40 ${s.heroSweep}`}
						/>
						<div
							className={`absolute pointer-events-none z-1 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${s.heroCross}`}
						/>
						<div className="absolute inset-0 pointer-events-none z-2 bg-[radial-gradient(ellipse_at_50%_50%,transparent_25%,rgba(2,2,2,0.88)_100%)]" />

						<div className="relative z-10 flex flex-col items-center gap-6 md:gap-8 px-6">
							<div
								className={`flex items-center gap-2 text-[8px] tracking-[0.28em] text-amber-500/65 border border-amber-500/16 px-4 py-2 bg-amber-500/2.5 ${rv(1)}`}
								data-rv
							>
								<div
									className={`w-1 h-1 rounded-full bg-amber-500 ${s.ctaWarnDot}`}
								/>
								EMERGENCY CO-ORDINATION SYSTEM
							</div>
							<h2
								className={`text-[clamp(26px,7vw,60px)] tracking-[0.12em] text-white leading-[1.1] ${rv(2)}`}
								data-rv
							>
								WHEN THE <span className="text-red-600">GRID</span>
								<br />
								GOES DARK.
							</h2>
							<p
								className={`text-[10px] tracking-[0.2em] text-(--dim) leading-loose max-w-[280px] md:max-w-none ${rv(3)}`}
								data-rv
							>
								Connect in seconds. No accounts. No servers.
								<br className="hidden md:block" /> Just open the app and join
								the network.
							</p>
							<div
								className={`flex gap-3 md:gap-4 flex-wrap justify-center ${rv(4)}`}
								data-rv
							>
								<Link
									className="text-[9px] tracking-[0.28em] px-6 md:px-7 py-3.25 text-red-300 no-underline border border-red-600/40 bg-red-600/8 transition-all duration-180 hover:bg-red-600/17 active:bg-red-600/25 hover:shadow-[0_0_24px_rgba(220,38,38,0.2)] cursor-none"
									href="/dashboard"
								>
									OPEN APP →
								</Link>
								<Link
									className="text-[9px] tracking-[0.28em] px-6 md:px-7 py-3.25 text-(--dim) no-underline border border-(--faint) bg-transparent transition-all duration-180 hover:text-white active:text-white hover:border-white/20 cursor-none"
									href="https://github.com/6xtvo/GridDown"
									rel="noreferrer"
									target="_blank"
								>
									VIEW SOURCE
								</Link>
							</div>
						</div>
					</section>

					<Footer />
				</div>
			</div>
		</>
	);
}
