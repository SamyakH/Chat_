import { QRCodeSVG } from 'qrcode.react'

interface Props {
  data: string
  size?: number
}

export default function QRDisplay({ data, size = 200 }: Props) {
  return (
    <div className="inline-flex p-4 bg-white rounded-xl shadow-lg">
      <QRCodeSVG value={data} size={size} level="H" includeMargin={false} />
    </div>
  )
}
