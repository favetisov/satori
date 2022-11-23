import type { ParsedTransformOrigin } from '../transform-origin'

import backgroundImage from './background-image'
import radius from './border-radius'
import { boxShadow } from './shadow'
import transform from './transform'
import overflow from './overflow'
import { buildXMLString } from '../utils'
import border, { getBorderClipPath } from './border'

export default async function rect(
  {
    id,
    left,
    top,
    width,
    height,
    isInheritingTransform,
    src,
    debug,
  }: {
    id: string
    left: number
    top: number
    width: number
    height: number
    isInheritingTransform: boolean
    src?: string
    debug?: boolean
  },
  style: Record<string, number | string>
) {
  if (style.display === 'none') return ''

  const isImage = !!src

  let type: 'rect' | 'path' = 'rect';
  let matrix = '';
  let borderMatrix = '';
  let defs = '';
  let fills: string[] = [];
  let opacity = 1;
  let extra = '';

  if (style.backgroundColor) {
      if (style.backgroundColor.replace(/ /g, '') == 'rgba(0,0,0,0)') {
          fills.push('none');
      } else {
          fills.push(style.backgroundColor as string)
      }
  }

  if (style.opacity !== undefined) {
    opacity = +style.opacity
  }

  const path = radius(
      { left, top, width, height },
      style as Record<string, number>
  )

  if (path) {
      type = 'path'
  }

  if (style.transform) {
    // matrix = transform(
    //   {
    //     left,
    //     top,
    //     width,
    //     height,
    //   },
    //   style.transform as unknown as number[],
    //   isInheritingTransform,
    //   style.transformOrigin as ParsedTransformOrigin | undefined
    // );
      // TODO add other transformations
      // console.log(style.transform, 'TRANSFORM');
      // matrix = `translate(${left},${top})`;
      matrix = '';



      const transform = {};
      style.transform.forEach(obj => {
          Object.keys(obj).forEach(k => {
              transform[k] = obj[k];
          })
      });

      matrix += 'translate(' + ((transform['translateX'] || 0) + left) + ', ' + ((transform['translateY'] || 0) + top) + ') ';
      borderMatrix = '';
      if (!src) {
          if (transform['scaleX'] || transform['scaleY']) {
              matrix += 'scale(' + (transform['scaleX'] || 0) + ', ' + (transform['scaleY'] || 0) + ') ';
              borderMatrix += 'scale(' + (transform['scaleX'] || 0) + ', ' + (transform['scaleY'] || 0) + ') ';
          } else if (transform['scale']) {
              matrix += 'scale(' + (transform['scale'] || 0) + ') ';
              borderMatrix += 'scale(' + (transform['scale'] || 0) + ')';
          }
      } else {
          const scale = style.transform.__parent?.find(k => k.scale)?.scale;
          if (scale) {
              matrix += 'scale(' + (scale)  + ') ';
              borderMatrix += 'scale(' + (scale)  + ') ';
          }
      }

      if (transform['rotate']) {
          let extraTO = '';
          if (style.transformOrigin) {
              const x = (style.transformOrigin['xAbsolute'] || 0);
              const y = (style.transformOrigin['yAbsolute']  || 0);
              extraTO = ', ' + x + ', ' + y;
          }
          matrix += 'rotate(' + transform['rotate'] + extraTO + ') ';
          borderMatrix += 'rotate(' + transform['rotate'] + extraTO + ') ';
      }
  } else if (!path) {
      matrix = `translate(${left},${top})`;
  }


    let backgroundShapes = ''
  if (style.backgroundImage) {
    const backgrounds: string[][] = []

    for (
      let index = 0;
      index < (style.backgroundImage as any).length;
      index++
    ) {
      const background = (style.backgroundImage as any)[index]
      const image = await backgroundImage(
        { id: id + '_' + index, width, height, left, top },
        background
      )
      if (image) {
        // Background images that come first in the array are rendered last.
        backgrounds.unshift(image)
      }
    }

    for (const background of backgrounds) {
      fills.push(`url(#${background[0]})`)
      defs += background[1]
      if (background[2]) {
        backgroundShapes += background[2]
      }
    }
  }



  const clipPathId = style._inheritedClipPathId as number | undefined
  const overflowMaskId = style._inheritedMaskId as number | undefined

  if (debug) {
    extra = buildXMLString('rect', {
      x: 0,
      y: 0,
      width,
      height,
      fill: 'transparent',
      stroke: '#ff5757',
      'stroke-width': 1,
      transform: matrix || undefined,
      'clip-path': clipPathId ? `url(#${clipPathId})` : undefined,
    })
  }

  const { backgroundClip, filter: cssFilter } = style

  let currentClipPath =
    backgroundClip === 'text'
      ? `url(#satori_bct-${id})`
      : clipPathId
      ? `url(#${clipPathId})`
      : undefined;


  if (style.clipPath && style.clipPath != 'none') {
      currentClipPath = style.clipPath.replace(/\"/g, "'");
  }

  const clip = overflow(
    { left, top, width, height, path, id, matrix, currentClipPath, src },
    style as Record<string, number>
  )

  // Each background generates a new rectangle.
  // @TODO: Not sure if this is the best way to do it, maybe <pattern> with
  // multiple <image>s is better.
  let shape = fills
    .map((fill) =>
      buildXMLString(type, {
        x: 0,
        y: 0,
        width,
        height,
        fill,
        d: path ? path : undefined,
        transform: matrix ? matrix : undefined,
        'clip-path': currentClipPath,
        style: cssFilter ? `filter:${cssFilter}` : undefined,
        // mask: overflowMaskId ? `url(#${overflowMaskId})` : undefined,
      })
    )
    .join('')

  const borderClip = getBorderClipPath(
    {
      id,
      left,
      top,
      width,
      height,
      currentClipPathId: clipPathId,
      borderPath: path,
      borderType: type,
    },
    style
  )

  // If it's an image (<img>) tag, we add an extra layer of the image itself.
  if (isImage) {
    // We need to subtract the border and padding sizes from the image size.
    const offsetLeft =
      ((style.borderLeftWidth as number) || 0) +
      ((style.paddingLeft as number) || 0)
    const offsetTop =
      ((style.borderTopWidth as number) || 0) +
      ((style.paddingTop as number) || 0)
    const offsetRight =
      ((style.borderRightWidth as number) || 0) +
      ((style.paddingRight as number) || 0)
    const offsetBottom =
      ((style.borderBottomWidth as number) || 0) +
      ((style.paddingBottom as number) || 0)

    const preserveAspectRatio =
      style.objectFit === 'contain'
        ? 'xMidYMid'
        : style.objectFit === 'cover'
        ? 'xMidYMid slice'
        : 'none'
    //
    // shape += buildXMLString('image', {
    //   x: left + offsetLeft,
    //   y: top + offsetTop,
    //   width: width - offsetLeft - offsetRight,
    //   height: height - offsetTop - offsetBottom,
    //   'href': src,
    //   preserveAspectRatio,
    //   transform: matrix ? matrix : undefined,
    //   style: cssFilter ? `filter:${cssFilter}` : undefined,
    //   'clip-path': `url(#satori_cp-${id})`,
    //   mask: `url(#satori_om-${id})`,
    // })

    shape += buildXMLString('image', {
      x: offsetLeft,
      y: offsetTop,
      width: width - offsetRight,
      height: height - offsetBottom,
      'href': src,
      preserveAspectRatio,
      transform: matrix ? matrix : undefined,
      style: cssFilter ? `filter:${cssFilter}` : undefined,
      'clip-path': currentClipPath,
      // mask: `url(#satori_om-${id})`,
    });
  }

  if (borderClip) {
    defs += borderClip[0]
    const rectClipId = borderClip[1]

    shape += border(
      {
        left,
        top,
        width,
        height,
        props: {
          transform: borderMatrix ? borderMatrix : undefined,
          // When using `background-clip: text`, we need to draw the extra border because
          // it shouldn't be clipped by the clip path, so we are not using currentClipPath here.
          'clip-path': `url(#${rectClipId})`,
        },
      },
      style
    );
  }

  // box-shadow.
  const shadow = boxShadow(
    {
      width,
      height,
      id,
      opacity,
      shape: buildXMLString(type, {
        x: 0,
        y: 0,
        width,
        height,
        fill: '#fff',
        stroke: '#fff',
        'stroke-width': 0,
        d: path ? path : undefined,
        // transform: matrix ? matrix : undefined,
        'clip-path': currentClipPath,
        // mask: overflowMaskId ? `url(#${overflowMaskId})` : undefined,
      }),
    },
    style
  )

  return (
    (defs ? buildXMLString('defs', {}, defs) : '') +
    (shadow ? shadow[0] : '') +
    clip +
    (opacity !== 1 ? `<g opacity="${opacity}">` : '') +
    (backgroundShapes || shape) +
    (opacity !== 1 ? `</g>` : '') +
    (shadow ? shadow[1] : '') +
    extra
  )
}
