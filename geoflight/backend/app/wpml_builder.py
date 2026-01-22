"""WPML XML generator for DJI missions - Compatible with DJI Fly WPML format."""

import time
from typing import Optional
from dataclasses import dataclass

from .models import Waypoint, DroneModel, FinishAction, CAMERA_PRESETS


@dataclass
class GimbalRotateParams:
    """Parameters for gimbalRotate action."""
    gimbal_heading_yaw_base: str = "aircraft"
    gimbal_rotate_mode: str = "absoluteAngle"
    gimbal_pitch_rotate_enable: int = 1
    gimbal_pitch_rotate_angle: float = -90  # Default to nadir for photogrammetry
    gimbal_roll_rotate_enable: int = 0
    gimbal_roll_rotate_angle: float = 0
    gimbal_yaw_rotate_enable: int = 0
    gimbal_yaw_rotate_angle: float = 0
    gimbal_rotate_time_enable: int = 0
    gimbal_rotate_time: float = 0
    payload_position_index: int = 0


class WPMLBuilder:
    """Build DJI WPML XML files for waypoint missions."""

    # IMPORTANT: Use the correct namespace for DJI WPML format
    WPML_NAMESPACE = "http://www.uav.com/wpmz/1.0.2"
    KML_NAMESPACE = "http://www.opengis.net/kml/2.2"

    def __init__(
        self,
        drone_model: DroneModel,
        waypoints: list[Waypoint],
        mission_name: Optional[str] = None,
    ):
        self.camera = CAMERA_PRESETS[drone_model]
        self.waypoints = waypoints
        self.mission_name = mission_name
        self.drone_model = drone_model
        self.action_id_counter = 1  # Global action ID counter, starts at 1

    def build_template_kml(self, finish_action: FinishAction = FinishAction.GO_HOME) -> str:
        """
        Generate template.kml content.

        This file contains only mission metadata and configuration.
        NOTE: Does NOT include waypoints - those go only in waylines.wpml
        """
        timestamp = int(time.time() * 1000)
        speed = self.waypoints[0].speed if self.waypoints else 5.0

        return f'''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="{self.KML_NAMESPACE}" xmlns:wpml="{self.WPML_NAMESPACE}">
  <Document>
    <wpml:author>GeoFlight Planner</wpml:author>
    <wpml:createTime>{timestamp}</wpml:createTime>
    <wpml:updateTime>{timestamp}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>{finish_action.value}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>{speed}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>{self.camera.drone_enum_value}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
  </Document>
</kml>
'''

    def build_waylines_wpml(self, gimbal_pitch: float = -90) -> str:
        """
        Generate waylines.wpml content.

        This file contains the executable waypoint data with actions.
        NOTE: Does NOT include author/createTime/updateTime - only missionConfig and Folder.

        Args:
            gimbal_pitch: Gimbal pitch angle for photos (-90 = nadir/straight down)
        """
        if not self.waypoints:
            raise ValueError("No waypoints provided")

        # Reset action ID counter for each generation
        self.action_id_counter = 1

        speed = self.waypoints[0].speed if self.waypoints else 5.0

        # Generate mission config
        mission_config = self._generate_mission_config()

        # Generate all placemarks
        placemarks = []
        for i, wp in enumerate(self.waypoints):
            is_first = (i == 0)
            is_last = (i == len(self.waypoints) - 1)
            placemark = self._generate_placemark(wp, is_first, is_last, gimbal_pitch)
            placemarks.append(placemark)

        placemarks_xml = '\n'.join(placemarks)

        return f'''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="{self.KML_NAMESPACE}" xmlns:wpml="{self.WPML_NAMESPACE}">
  <Document>
{mission_config}
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:distance>0</wpml:distance>
      <wpml:duration>0</wpml:duration>
      <wpml:autoFlightSpeed>{speed}</wpml:autoFlightSpeed>
{placemarks_xml}
    </Folder>
  </Document>
</kml>
'''

    def _generate_mission_config(self) -> str:
        """Generate missionConfig block for waylines.wpml."""
        speed = self.waypoints[0].speed if self.waypoints else 5.0

        return f'''    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>{speed}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>{self.camera.drone_enum_value}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>'''

    def _generate_placemark(self, wp: Waypoint, is_first: bool, is_last: bool, gimbal_pitch: float) -> str:
        """
        Generate a complete Placemark element for a waypoint.

        Args:
            wp: Waypoint data
            is_first: True if this is the first waypoint
            is_last: True if this is the last waypoint
            gimbal_pitch: Gimbal pitch angle for photos
        """
        # Determine turn mode and heading enable based on position
        if is_first or is_last:
            turn_mode = "toPointAndStopWithContinuityCurvature"
            heading_angle_enable = 1
        else:
            turn_mode = "toPointAndPassWithContinuityCurvature"
            heading_angle_enable = 0

        # Base placemark structure
        placemark_xml = f'''      <Placemark>
        <Point>
          <coordinates>
            {wp.longitude},{wp.latitude}
          </coordinates>
        </Point>
        <wpml:index>{wp.index}</wpml:index>
        <wpml:executeHeight>{wp.altitude}</wpml:executeHeight>
        <wpml:waypointSpeed>{wp.speed}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>{int(wp.heading)}</wpml:waypointHeadingAngle>
          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
          <wpml:waypointHeadingAngleEnable>{heading_angle_enable}</wpml:waypointHeadingAngleEnable>
          <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>{turn_mode}</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>1</wpml:useStraightLine>'''

        # Add action groups
        action_groups = []

        if is_first and wp.take_photo:
            # First waypoint: takePhoto + gimbalRotate
            gimbal_params = GimbalRotateParams(gimbal_pitch_rotate_angle=gimbal_pitch)
            actions = [
                self._generate_action_take_photo(),
                self._generate_action_gimbal_rotate(gimbal_params)
            ]
            action_groups.append(self._generate_action_group(1, wp.index, wp.index, actions))

            # Add gimbalEvenlyRotate for transition to next waypoint
            if len(self.waypoints) > 1:
                actions2 = [self._generate_action_gimbal_evenly_rotate()]
                action_groups.append(self._generate_action_group(2, wp.index, wp.index + 1, actions2))

        elif not is_last and wp.take_photo:
            # Intermediate waypoints: takePhoto + gimbalEvenlyRotate
            actions = [self._generate_action_take_photo()]
            action_groups.append(self._generate_action_group(1, wp.index, wp.index, actions))

            if wp.index < len(self.waypoints) - 1:
                actions2 = [self._generate_action_gimbal_evenly_rotate()]
                action_groups.append(self._generate_action_group(2, wp.index, wp.index + 1, actions2))

        elif is_last and wp.take_photo:
            # Last waypoint: only takePhoto
            actions = [self._generate_action_take_photo()]
            action_groups.append(self._generate_action_group(1, wp.index, wp.index, actions))

        # Add action groups to XML
        if action_groups:
            placemark_xml += '\n' + '\n'.join(action_groups)

        # Close placemark with gimbal heading param
        placemark_xml += f'''
        <wpml:waypointGimbalHeadingParam>
          <wpml:waypointGimbalPitchAngle>{int(wp.gimbal_pitch)}</wpml:waypointGimbalPitchAngle>
          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>
        </wpml:waypointGimbalHeadingParam>
      </Placemark>'''

        return placemark_xml

    def _generate_action_take_photo(self) -> str:
        """Generate takePhoto action XML."""
        action_id = self.action_id_counter
        self.action_id_counter += 1
        return f'''          <wpml:action>
            <wpml:actionId>{action_id}</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>'''

    def _generate_action_gimbal_rotate(self, params: GimbalRotateParams) -> str:
        """Generate gimbalRotate action XML."""
        action_id = self.action_id_counter
        self.action_id_counter += 1
        return f'''          <wpml:action>
            <wpml:actionId>{action_id}</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalHeadingYawBase>{params.gimbal_heading_yaw_base}</wpml:gimbalHeadingYawBase>
              <wpml:gimbalRotateMode>{params.gimbal_rotate_mode}</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>{params.gimbal_pitch_rotate_enable}</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>{params.gimbal_pitch_rotate_angle}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>{params.gimbal_roll_rotate_enable}</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>{params.gimbal_roll_rotate_angle}</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>{params.gimbal_yaw_rotate_enable}</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>{params.gimbal_yaw_rotate_angle}</wpml:gimbalYawRotateAngle>
              <wpml:gimbalRotateTimeEnable>{params.gimbal_rotate_time_enable}</wpml:gimbalRotateTimeEnable>
              <wpml:gimbalRotateTime>{params.gimbal_rotate_time}</wpml:gimbalRotateTime>
              <wpml:payloadPositionIndex>{params.payload_position_index}</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>'''

    def _generate_action_gimbal_evenly_rotate(self) -> str:
        """Generate gimbalEvenlyRotate action XML."""
        action_id = self.action_id_counter
        self.action_id_counter += 1
        return f'''          <wpml:action>
            <wpml:actionId>{action_id}</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalEvenlyRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalPitchRotateAngle>0</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>'''

    def _generate_action_group(self, group_id: int, start_index: int, end_index: int,
                               actions: list[str], mode: str = "parallel",
                               trigger_type: str = "reachPoint") -> str:
        """
        Generate an action group XML block.

        Args:
            group_id: Action group ID (starts at 1)
            start_index: Waypoint index where group starts
            end_index: Waypoint index where group ends
            actions: List of action XML strings
            mode: "parallel" or "sequence"
            trigger_type: "reachPoint", "betweenAdjacentPoints", or "multipleTiming"
        """
        actions_xml = '\n'.join(actions)
        return f'''        <wpml:actionGroup>
          <wpml:actionGroupId>{group_id}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>{start_index}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>{end_index}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>{mode}</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>{trigger_type}</wpml:actionTriggerType>
          </wpml:actionTrigger>
{actions_xml}
        </wpml:actionGroup>'''
