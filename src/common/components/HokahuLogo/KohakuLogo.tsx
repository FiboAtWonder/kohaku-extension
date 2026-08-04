import React from 'react'
import { Image, ImageStyle, StyleProp, ViewStyle } from 'react-native'
import kohakuLogo from '@web/assets/kohaku.png'

type KohakuLogoProps = {
  width?: number
  height?: number
  // Accepts the shared `spacings` entries, which are typed as a broad style union
  style?: StyleProp<ImageStyle | ViewStyle>
}

const KohakuLogo: React.FC<KohakuLogoProps> = ({ width = 83, height = 28, style }) => {
  return (
    <Image source={{ uri: kohakuLogo }} style={[{ width, height }, style as StyleProp<ImageStyle>]} resizeMode="contain" />
  )
}

export default React.memo(KohakuLogo)
