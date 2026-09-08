export class ExpandImageEffect {
  constructor(el) {
    if (!el || !(el instanceof HTMLElement)) {
      throw new Error('Invalid element provided.');
    }

    this.wrapElement = el;
    this.image = this.wrapElement.querySelector('.type__expand-img');
    this.expandTexts = this.wrapElement.querySelectorAll('.anim');
    this.textBlock = this.wrapElement.nextElementSibling;
    this.contentContainer = this.wrapElement.closest('.content') || this.wrapElement;

    this.initializeEffect();
  }
  
  initializeEffect() {
    this.scroll();
  }

  scroll() {
    this.wrapElement.classList.add('type--open');
    const flipstate = Flip.getState([
      this.image,
      this.expandTexts
    ], {
      props: 'transform'
    });
    this.wrapElement.classList.remove('type--open');
    
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: this.contentContainer,
        start: 'center center',
        end: '+=120%',
        pin: true,
        scrub: 1,
        anticipatePin: 1
      }
    });

    tl.add(Flip.to(flipstate, {
      ease: 'sine.inOut',
      simple: true,
      duration: 1
    }), 0);

    tl.fromTo(this.textBlock, {
      xPercent: 0,
      skewX: 0,
    }, {
      ease: 'sine.inOut',
      xPercent: 0,
      skewX: 0,
      opacity: 1,
      duration: 1
    }, 0);

    // Hold pinned when fully opened
    tl.to({}, { duration: 1 });
  }
}
