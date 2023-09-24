import Link from "next/link";
import Image from "next/image";
//import { SignOutButton, SignedIn, OrganizationSwitcher } from "@clerk/nextjs";
//import { dark } from "@clerk/themes";
//text-light-1
function Topbar() {
  return (
    <nav className="topbar">
      <Link href="/" className="flex items-center gap-4">
        <Image src="/assets/logo.svg" alt="logo" width={28} height={28} />
        <p className="text-heading3-bold  max-xs:hidden">Threads</p>
      </Link>

      <div className="flex items-center gap-1">
        <div className="block md:hidden">
          SignOut Button
        </div>


      </div>
    </nav>
  )
}
export default Topbar;
/**
          <SignedIn>
            <SignOutButton>
              <div className="flex cursor-pointer">
                <Image src="/assets/logout.svg" alt="logout" width={24} height={24} />
              </div>
            </SignOutButton>
          </SignedIn>

        <OrganizationSwitcher
          appearance={{
            baseTheme: dark,
            elements: {
              organizationSwitcherTrigger: "py-2 px-4"
            }
          }}
        />

 */