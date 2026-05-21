import Link from "next/link";

export default function Footer() {
	return (
		<footer
			className="border-t bg-[#020202]/95 backdrop-blur-[10px] snap-end"
			style={{ borderColor: "rgba(220,38,38,0.08)" }}
		>
			<div className="w-full px-10 py-5 flex items-center justify-between">
				<span className="text-[7px] tracking-[0.2em] text-(--dim)">
					© {new Date().getFullYear()} OPEN SOURCE
				</span>{" "}
				<div className="flex items-end gap-6">
					<Link
						className="text-[7px] tracking-[0.28em] text-(--dim) no-underline transition-colors duration-180 hover:text-(--text) cursor-none"
						href="https://github.com/6xtvo/GridDown"
						rel="noreferrer"
						target="_blank"
					>
						GITHUB
					</Link>
					<Link
						className="text-[7px] tracking-[0.28em] text-(--dim) no-underline transition-colors duration-180 hover:text-(--text) cursor-none"
						href="https://buckley-presents.vercel.app/"
						rel="noreferrer"
						target="_blank"
					>
						PRESENTATION
					</Link>
					<Link
						className="text-[7px] tracking-[0.28em] text-red-600/60 no-underline transition-colors duration-180 hover:text-red-400 cursor-none"
						href="/dashboard"
					>
						OPEN APP →
					</Link>
				</div>
			</div>
		</footer>
	);
}
