import type { CardPublicLinkType } from "@/card-data/types";
import {
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  WebsiteIcon,
} from "@/components/hi/icons/HiCardIcons";

type HiSocialLinkIconProps = {
  type: CardPublicLinkType;
};

export function HiSocialLinkIcon({ type }: HiSocialLinkIconProps) {
  const size = 18;
  switch (type) {
    case "website":
      return <WebsiteIcon size={size} />;
    case "github":
      return <GitHubIcon size={size} />;
    case "linkedin":
      return <LinkedInIcon size={size} />;
    case "instagram":
      return <InstagramIcon size={size} />;
  }
}
