/**
 * WPML XML generator for DJI missions - Compatible with DJI Fly WPML format.
 * Port of backend/app/wpml_builder.py
 */

import type { Waypoint, DroneModel, FinishAction, CameraSpec } from '../../types';
import { CAMERA_PRESETS } from '../../types';

interface GimbalRotateParams {
  gimbalHeadingYawBase: string;
  gimbalRotateMode: string;
  gimbalPitchRotateEnable: number;
  gimbalPitchRotateAngle: number;
  gimbalRollRotateEnable: number;
  gimbalRollRotateAngle: number;
  gimbalYawRotateEnable: number;
  gimbalYawRotateAngle: number;
  gimbalRotateTimeEnable: number;
  gimbalRotateTime: number;
  payloadPositionIndex: number;
}

const DEFAULT_GIMBAL_PARAMS: GimbalRotateParams = {
  gimbalHeadingYawBase: 'aircraft',
  gimbalRotateMode: 'absoluteAngle',
  gimbalPitchRotateEnable: 1,
  gimbalPitchRotateAngle: -90, // Default to nadir for photogrammetry
  gimbalRollRotateEnable: 1, // Must be 1 for DJI Fly compatibility
  gimbalRollRotateAngle: 0,
  gimbalYawRotateEnable: 0,
  gimbalYawRotateAngle: 0,
  gimbalRotateTimeEnable: 0,
  gimbalRotateTime: 0,
  payloadPositionIndex: 0,
};

// Namespaces for DJI WPML format
const WPML_NAMESPACE = 'http://www.uav.com/wpmz/1.0.2';
const KML_NAMESPACE = 'http://www.opengis.net/kml/2.2';

export class WPMLBuilder {
  private camera: CameraSpec;
  private waypoints: Waypoint[];
  private actionIdCounter: number = 1;

  constructor(
    droneModel: DroneModel,
    waypoints: Waypoint[],
    _missionName?: string
  ) {
    this.camera = CAMERA_PRESETS[droneModel];
    this.waypoints = waypoints;
  }

  /**
   * Generate template.kml content.
   * This file contains only mission metadata and configuration.
   * NOTE: Does NOT include waypoints - those go only in waylines.wpml
   */
  buildTemplateKml(finishAction: FinishAction = 'goHome'): string {
    const timestamp = Date.now();
    const speed = this.waypoints[0]?.speed ?? 5.0;

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="${KML_NAMESPACE}" xmlns:wpml="${WPML_NAMESPACE}">
  <Document>
    <wpml:author>GeoFlight Planner</wpml:author>
    <wpml:createTime>${timestamp}</wpml:createTime>
    <wpml:updateTime>${timestamp}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${finishAction}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${speed}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${this.camera.drone_enum_value}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
  </Document>
</kml>
`;
  }

  /**
   * Generate waylines.wpml content.
   * This file contains the executable waypoint data with actions.
   *
   * NOTE: Each waypoint can have its own gimbal_pitch value.
   * The defaultGimbalPitch is only used if a waypoint doesn't have one set.
   */
  buildWaylinesWpml(defaultGimbalPitch: number = -90): string {
    if (this.waypoints.length === 0) {
      throw new Error('No waypoints provided');
    }

    // Reset action ID counter for each generation
    this.actionIdCounter = 1;

    const speed = this.waypoints[0]?.speed ?? 5.0;

    // Generate mission config
    const missionConfig = this.generateMissionConfig();

    // Generate all placemarks - each waypoint uses its own gimbal_pitch
    const placemarks: string[] = [];
    for (let i = 0; i < this.waypoints.length; i++) {
      const wp = this.waypoints[i];
      const isFirst = i === 0;
      const isLast = i === this.waypoints.length - 1;
      // Use waypoint's individual gimbal_pitch, fallback to default
      const wpGimbalPitch = wp.gimbal_pitch ?? defaultGimbalPitch;
      // For gimbalEvenlyRotate, we need the NEXT waypoint's pitch (transition target)
      const nextWp = i < this.waypoints.length - 1 ? this.waypoints[i + 1] : null;
      const nextGimbalPitch = nextWp?.gimbal_pitch ?? wpGimbalPitch;
      placemarks.push(this.generatePlacemark(wp, isFirst, isLast, wpGimbalPitch, nextGimbalPitch));
    }

    const placemarksXml = placemarks.join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="${KML_NAMESPACE}" xmlns:wpml="${WPML_NAMESPACE}">
  <Document>
${missionConfig}
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:distance>0</wpml:distance>
      <wpml:duration>0</wpml:duration>
      <wpml:autoFlightSpeed>${speed}</wpml:autoFlightSpeed>
${placemarksXml}
    </Folder>
  </Document>
</kml>
`;
  }

  private generateMissionConfig(): string {
    const speed = this.waypoints[0]?.speed ?? 5.0;

    return `    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${speed}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${this.camera.drone_enum_value}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>`;
  }

  private generatePlacemark(
    wp: Waypoint,
    isFirst: boolean,
    isLast: boolean,
    gimbalPitch: number,
    nextGimbalPitch?: number
  ): string {
    // For gimbalEvenlyRotate: use next waypoint's pitch as transition target
    const transitionPitch = nextGimbalPitch ?? gimbalPitch;
    // Determine turn mode and heading enable based on position
    let turnMode: string;
    let headingAngleEnable: number;

    if (isFirst || isLast) {
      turnMode = 'toPointAndStopWithContinuityCurvature';
      headingAngleEnable = 1;
    } else {
      turnMode = 'toPointAndPassWithContinuityCurvature';
      headingAngleEnable = 0;
    }

    // Base placemark structure
    // NOTE: DJI Fly RC2 requires specific values:
    // - executeHeight must be integer
    // - waypointHeadingAngle must be 0 when using followWayline mode
    // - useStraightLine must be 0
    let placemarkXml = `      <Placemark>
        <Point>
          <coordinates>
            ${wp.longitude},${wp.latitude}
          </coordinates>
        </Point>
        <wpml:index>${wp.index}</wpml:index>
        <wpml:executeHeight>${Math.floor(wp.altitude)}</wpml:executeHeight>
        <wpml:waypointSpeed>${wp.speed}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
          <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>
          <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>0</wpml:useStraightLine>`;

    // Add action groups
    // NOTE: Based on DJI Fly RC2 analysis:
    // - takePhoto ONLY on first waypoint
    // - gimbalRotate ONLY on first waypoint
    // - gimbalEvenlyRotate on ALL waypoints except the last one
    const actionGroups: string[] = [];

    if (isFirst) {
      // First waypoint: takePhoto + gimbalRotate (set initial gimbal position)
      const gimbalParams: GimbalRotateParams = {
        ...DEFAULT_GIMBAL_PARAMS,
        gimbalPitchRotateAngle: gimbalPitch,
      };
      const actions = [
        this.generateActionTakePhoto(),
        this.generateActionGimbalRotate(gimbalParams),
      ];
      actionGroups.push(this.generateActionGroup(1, wp.index, wp.index, actions));

      // Add gimbalEvenlyRotate for transition to next waypoint (uses next wp's pitch)
      if (this.waypoints.length > 1) {
        const actions2 = [this.generateActionGimbalEvenlyRotate(transitionPitch)];
        actionGroups.push(this.generateActionGroup(2, wp.index, wp.index + 1, actions2));
      }
    } else if (!isLast) {
      // Intermediate waypoints: gimbalEvenlyRotate for smooth transition to next waypoint
      const actions = [this.generateActionGimbalEvenlyRotate(transitionPitch)];
      actionGroups.push(this.generateActionGroup(2, wp.index, wp.index + 1, actions));
    }
    // Last waypoint: NO action groups (as seen in DJI file)

    // Add action groups to XML
    if (actionGroups.length > 0) {
      placemarkXml += '\n' + actionGroups.join('\n');
    }

    // Close placemark with gimbal heading param
    // NOTE: waypointGimbalPitchAngle must be 0 for DJI Fly RC2 compatibility
    placemarkXml += `
        <wpml:waypointGimbalHeadingParam>
          <wpml:waypointGimbalPitchAngle>0</wpml:waypointGimbalPitchAngle>
          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>
        </wpml:waypointGimbalHeadingParam>
      </Placemark>`;

    return placemarkXml;
  }

  private generateActionTakePhoto(): string {
    const actionId = this.actionIdCounter++;
    return `          <wpml:action>
            <wpml:actionId>${actionId}</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
  }

  private generateActionGimbalRotate(params: GimbalRotateParams): string {
    const actionId = this.actionIdCounter++;
    return `          <wpml:action>
            <wpml:actionId>${actionId}</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalHeadingYawBase>${params.gimbalHeadingYawBase}</wpml:gimbalHeadingYawBase>
              <wpml:gimbalRotateMode>${params.gimbalRotateMode}</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>${params.gimbalPitchRotateEnable}</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>${Math.floor(params.gimbalPitchRotateAngle)}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>${params.gimbalRollRotateEnable}</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>${Math.floor(params.gimbalRollRotateAngle)}</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>${params.gimbalYawRotateEnable}</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>${Math.floor(params.gimbalYawRotateAngle)}</wpml:gimbalYawRotateAngle>
              <wpml:gimbalRotateTimeEnable>${params.gimbalRotateTimeEnable}</wpml:gimbalRotateTimeEnable>
              <wpml:gimbalRotateTime>${Math.floor(params.gimbalRotateTime)}</wpml:gimbalRotateTime>
              <wpml:payloadPositionIndex>${params.payloadPositionIndex}</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
  }

  private generateActionGimbalEvenlyRotate(gimbalPitch: number = -90): string {
    const actionId = this.actionIdCounter++;
    return `          <wpml:action>
            <wpml:actionId>${actionId}</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalEvenlyRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalPitchRotateAngle>${Math.floor(gimbalPitch)}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
  }

  private generateActionGroup(
    groupId: number,
    startIndex: number,
    endIndex: number,
    actions: string[],
    mode: string = 'parallel',
    triggerType: string = 'reachPoint'
  ): string {
    const actionsXml = actions.join('\n');
    return `        <wpml:actionGroup>
          <wpml:actionGroupId>${groupId}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${startIndex}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${endIndex}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>${mode}</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>${triggerType}</wpml:actionTriggerType>
          </wpml:actionTrigger>
${actionsXml}
        </wpml:actionGroup>`;
  }
}
