import Image from "next/image";
import Link from "next/link";

import styles from "@/styles/components/nav.module.css";

export default function Nav() {
	return (
		<nav className="fixed top-0 inset-x-0 z-500 h-13 flex items-center justify-between px-10 bg-[#020202]/90 border-b border-red-600/10 backdrop-blur-[10px]">
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

			<ul className="flex gap-7 list-none">
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

			<Link
				className="text-[9px] tracking-[0.28em] text-red-400 no-underline px-4 py-1.75 border border-red-600/35 bg-red-600/6 transition-all duration-180 hover:bg-red-600/13 hover:shadow-[0_0_16px_rgba(220,38,38,0.18)] cursor-none"
				href="/dashboard"
			>
				OPEN APP →
			</Link>
		</nav>
	);
}
