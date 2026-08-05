import React from 'react'
import { Image, ImageStyle, StyleProp, ViewStyle} from 'react-native'
import kohakuLogoHorizontal from '../../../web/assets/kohaku-horizontal.png'

type AmbireLogoHorizontalProps = {
  width?: number
  height?: number
  // Accepts the shared `spacings` entries, which are typed as a broad style union
  style?: StyleProp<ImageStyle | ViewStyle>
}

const AmbireLogoHorizontal: React.FC<AmbireLogoHorizontalProps> = ({
  width = 83,
  height = 28,
  style
}) => {
  return (
    <Image
      source={{ uri: kohakuLogoHorizontal }}
      style={[{ width, height }, style as StyleProp<ImageStyle>]}
      resizeMode="contain"
    />
  )
}

export default React.memo(AmbireLogoHorizontal)
