import micahTheme from "@avatune/micah-theme/solidjs"
import { Avatar } from "@avatune/solidjs"

export default function Home() {
  return (
    <div>
      <Avatar theme={micahTheme} seed="example-12345" size={200} />
    </div>
  )
}
