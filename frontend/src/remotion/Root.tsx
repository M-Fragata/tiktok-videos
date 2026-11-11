import React from 'react';
import { Composition } from 'remotion';
import { TimeMachineVideo } from './TimeMachineVideo';
import { defaultTimeMachineProps } from './types';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TimeMachineVideo"
        component={TimeMachineVideo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultTimeMachineProps}
      />
    </>
  );
};

