import homeImage from '../assets/homepage.jpeg'
import loginImage from '../assets/loginpage.jpeg'

const contentByVariant = {
  hero: {
    image: homeImage,
  },
  auth: {
    image: loginImage,
  },
}

export default function GigIllustration({ variant = 'hero' }) {
  const content = contentByVariant[variant] ?? contentByVariant.hero

  return (
    <div className={`gig-illustration gig-illustration--${variant}`} aria-hidden="true">
      <div className="gig-illustration__frame">
        <img
          className="gig-illustration__image"
          src={content.image}
          alt=""
          loading="lazy"
        />
        <div className="gig-illustration__shade" />
      </div>
    </div>
  )
}
