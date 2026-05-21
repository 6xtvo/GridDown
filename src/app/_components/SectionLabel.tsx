export default function SectionLabel({
	label,
	className = "",
	"data-rv": dataRv,
}: {
	label: string;
	className?: string;
	"data-rv"?: boolean;
}) {
	return (
		<div
			className={`flex items-center gap-2.5 text-[8px] tracking-[0.45em] text-red-600 ${className}`}
			{...(dataRv !== undefined ? { "data-rv": true } : {})}
		>
			<span
				aria-hidden
				style={{
					display: "block",
					width: 20,
					height: 1,
					background: "#dc2626",
					flexShrink: 0,
				}}
			/>
			{label}
		</div>
	);
}
