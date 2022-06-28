import React, { Component } from 'react'
import { Platform, ScrollView, Text, TouchableOpacity, View, PermissionsAndroid, Dimensions } from 'react-native'
// Import the RtcEngine class and view rendering components into your project.
import RtcEngine, { ChannelProfile, ClientRole, RtcLocalView, RtcRemoteView, VideoMirrorMode, VideoRenderMode } from 'react-native-agora'
// Import the UI styles.
import styles from './components/Style'
import RNFetchBlob from 'rn-fetch-blob'

const requestCameraAndAudioPermission = async () => {
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ])
    if (
      granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED
      && granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED
    ) {
      console.log('You can use the cameras & mic')
    } else {
      console.log('Permission denied')
    }
  } catch (err) {
    console.warn(err)
  }
}

// Define a Props interface.
interface Props {
}

// Define a State interface.
interface State {
  appId: string,
  channelName: string,
  token: string,
  joinSucceed: boolean,
  peerIds: number[],
}

// Create an App component, which extends the properties of the Pros and State interfaces.
export default class App extends Component<Props, State> {
  _engine?: RtcEngine

  constructor(props: Props | Readonly<Props>) {
    super(props)
    this.state = {
      appId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
      channelName: 'looper',
      token: 'XXXXXXXXXXXXXXXXXXXXXXXXXXX',
      joinSucceed: false,
      peerIds: [],
    }
    if (Platform.OS === 'android') {
      requestCameraAndAudioPermission().then(() => {
        console.log('requested!')
      })
    }
  }

  // Mount the App component into the DOM.
  componentDidMount() {
    this.init()
  }
  // Pass in your App ID through this.state, create and initialize an RtcEngine object.
  init = async () => {
    const { appId } = this.state
    this._engine = await RtcEngine.create(appId)
    // Enable the video module.
    await this._engine.enableVideo()

    await this._engine.startPreview()
    // Set the channel profile as live streaming.
    await this._engine.setChannelProfile(ChannelProfile.LiveBroadcasting)
    // Set the usr role as host.
    await this._engine.setClientRole(ClientRole.Broadcaster)

    // This callback occurs when the remote user successfully joins the channel.
    this._engine.addListener('UserJoined', (uid, elapsed) => {
      console.log('UserJoined', uid, elapsed)
      const { peerIds } = this.state
      if (peerIds.indexOf(uid) === -1) {
        this.setState({
          peerIds: [...peerIds, uid]
        })
      }
    })

    // Listen for the UserOffline callback.
    // This callback occurs when the remote user leaves the channel or drops offline.
    this._engine.addListener('UserOffline', (uid, reason) => {
      console.log('UserOffline', uid, reason)
      const { peerIds } = this.state
      this.setState({
        // Remove peer ID from state array
        peerIds: peerIds.filter(id => id !== uid)
      })
    })

    // Listen for the JoinChannelSuccess callback.
    // This callback occurs when the local user successfully joins the channel.
    this._engine.addListener('JoinChannelSuccess', (channel, uid, elapsed) => {
      console.log('JoinChannelSuccess', channel, uid, elapsed)
      this.setState({
        joinSucceed: true
      })
    })
  }
  // Pass in your token and channel name through this.state.token and this.state.channelName.
  // Set the ID of the local user, which is an integer and should be unique. If you set uid as 0, 
  // the SDK assigns a user ID for the local user and returns it in the JoinChannelSuccess callback.
  startCall = async () => {
    await this._engine?.joinChannel(this.state.token, this.state.channelName, null, 0)
  }

  render() {
    return (
      <View style={styles.max}>
        <View style={styles.max}>
          <View style={styles.buttonHolder}>
            <TouchableOpacity
              onPress={this.startCall}
              style={styles.button}>
              <Text style={styles.buttonText}> Start Call </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={this.endCall}
              style={styles.button}>
              <Text style={styles.buttonText}> End Call </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={this.enableWatermark}
              style={styles.button}>
              <Text style={styles.buttonText}> Enable Watermark </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={this.disableWatermark}
              style={styles.button}>
              <Text style={styles.buttonText}> Disable Watermark </Text>
            </TouchableOpacity>
          </View>
          {this._renderVideos()}
        </View>
      </View>
    )
  }

  // Set the rendering mode of the video view as Hidden, 
  // which uniformly scales the video until it fills the visible boundaries.
  _renderVideos = () => {
    const { joinSucceed } = this.state
    return joinSucceed ? (
      <View style={styles.fullView}>
        <RtcLocalView.SurfaceView
          style={styles.max}
          channelId={this.state.channelName}
          renderMode={VideoRenderMode.Hidden}
        //mirrorMode={VideoMirrorMode.Enabled}

        //mirrorMode={VideoMirrorMode.Disabled}
        />
        {this._renderRemoteVideos()}
      </View>
    ) : null
  }

  // Set the rendering mode of the video view as Hidden, 
  // which uniformly scales the video until it fills the visible boundaries.
  _renderRemoteVideos = () => {
    const { peerIds } = this.state
    return (
      <ScrollView
        style={styles.remoteContainer}
        contentContainerStyle={{ paddingHorizontal: 2.5 }}
        horizontal={true}>
        {peerIds.map((value, index, array) => {
          return (
            <RtcRemoteView.SurfaceView
              style={styles.remote}
              uid={value}
              channelId={this.state.channelName}
              renderMode={VideoRenderMode.Hidden}
              zOrderMediaOverlay={true} />
          )
        })}
      </ScrollView>
    )
  }

  endCall = async () => {
    await this._engine?.leaveChannel()
    this.setState({ peerIds: [], joinSucceed: false })
  }

  enableWatermark = async () => {

    const file = await RNFetchBlob.config(
      { fileCache: true, appendExt: "png", }
    ).fetch(
      "GET",
      "https://storage.googleapis.com/sogood-live-backend.appspot.com/assets/WATERMARK.png",
      { type: "image" }
    );

    const path = file.path();
    await this._engine?.addVideoWatermark(path, {
      positionInPortraitMode: { x: 40, y: Dimensions.get("window").height / 2, width: 200, height: 27 }
      //, visibleInPreview: false
    });

    console.log(path);
  }

  disableWatermark = async () => {
    await this._engine?.clearVideoWatermarks()
  }

}

