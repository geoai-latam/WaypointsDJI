"""WPML XML generator for DJI missions."""

import xml.etree.ElementTree as ET
from xml.dom import minidom
from typing import Optional
import uuid
from datetime import datetime

from .models import Waypoint, CameraSpec, FinishAction, DroneModel, CAMERA_PRESETS


class WPMLBuilder:
    """Build DJI WPML XML files for waypoint missions."""

    WPML_NAMESPACE = "http://www.dji.com/wpmz/1.0.2"
    KML_NAMESPACE = "http://www.opengis.net/kml/2.2"

    def __init__(
        self,
        drone_model: DroneModel,
        waypoints: list[Waypoint],
        mission_name: Optional[str] = None,
    ):
        self.camera = CAMERA_PRESETS[drone_model]
        self.waypoints = waypoints
        self.mission_name = mission_name or f"Mission_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.drone_model = drone_model

    def build_template_kml(self, finish_action: FinishAction = FinishAction.GO_HOME) -> str:
        """
        Generate template.kml content.

        This file contains mission metadata and folder structure.
        """
        # Register namespaces
        ET.register_namespace("", self.KML_NAMESPACE)
        ET.register_namespace("wpml", self.WPML_NAMESPACE)

        # Root element
        kml = ET.Element("kml", {
            "xmlns": self.KML_NAMESPACE,
            "xmlns:wpml": self.WPML_NAMESPACE,
        })

        document = ET.SubElement(kml, "Document")

        # Mission info
        ET.SubElement(document, "{%s}author" % self.WPML_NAMESPACE).text = "GeoFlight Planner"
        ET.SubElement(document, "{%s}createTime" % self.WPML_NAMESPACE).text = str(
            int(datetime.now().timestamp() * 1000)
        )
        ET.SubElement(document, "{%s}updateTime" % self.WPML_NAMESPACE).text = str(
            int(datetime.now().timestamp() * 1000)
        )

        # Mission config
        mission_config = ET.SubElement(document, "{%s}missionConfig" % self.WPML_NAMESPACE)
        ET.SubElement(mission_config, "{%s}flyToWaylineMode" % self.WPML_NAMESPACE).text = "safely"
        ET.SubElement(mission_config, "{%s}finishAction" % self.WPML_NAMESPACE).text = finish_action.value
        ET.SubElement(mission_config, "{%s}exitOnRCLost" % self.WPML_NAMESPACE).text = "executeLostAction"
        ET.SubElement(mission_config, "{%s}executeRCLostAction" % self.WPML_NAMESPACE).text = "goBack"
        ET.SubElement(mission_config, "{%s}globalTransitionalSpeed" % self.WPML_NAMESPACE).text = "10"

        # Drone info
        drone_info = ET.SubElement(mission_config, "{%s}droneInfo" % self.WPML_NAMESPACE)
        ET.SubElement(drone_info, "{%s}droneEnumValue" % self.WPML_NAMESPACE).text = str(
            self.camera.drone_enum_value
        )
        ET.SubElement(drone_info, "{%s}droneSubEnumValue" % self.WPML_NAMESPACE).text = "0"

        # Payload info
        payload_info = ET.SubElement(mission_config, "{%s}payloadInfo" % self.WPML_NAMESPACE)
        ET.SubElement(payload_info, "{%s}payloadEnumValue" % self.WPML_NAMESPACE).text = str(
            self.camera.payload_enum_value
        )
        ET.SubElement(payload_info, "{%s}payloadSubEnumValue" % self.WPML_NAMESPACE).text = "0"
        ET.SubElement(payload_info, "{%s}payloadPositionIndex" % self.WPML_NAMESPACE).text = "0"

        # Folder with waylines
        folder = ET.SubElement(document, "Folder")
        ET.SubElement(folder, "{%s}templateType" % self.WPML_NAMESPACE).text = "waypoint"
        ET.SubElement(folder, "{%s}templateId" % self.WPML_NAMESPACE).text = "0"
        ET.SubElement(folder, "{%s}autoFlightSpeed" % self.WPML_NAMESPACE).text = str(
            self.waypoints[0].speed if self.waypoints else 5.0
        )

        # Wayline coordinate mode
        ET.SubElement(
            folder, "{%s}waylineCoordinateSysParam" % self.WPML_NAMESPACE
        )
        coord_param = folder.find("{%s}waylineCoordinateSysParam" % self.WPML_NAMESPACE)
        ET.SubElement(
            coord_param, "{%s}coordinateMode" % self.WPML_NAMESPACE
        ).text = "WGS84"
        ET.SubElement(
            coord_param, "{%s}heightMode" % self.WPML_NAMESPACE
        ).text = "relativeToStartPoint"

        # Global waypoint settings
        ET.SubElement(folder, "{%s}globalWaypointHeadingParam" % self.WPML_NAMESPACE)
        heading_param = folder.find("{%s}globalWaypointHeadingParam" % self.WPML_NAMESPACE)
        ET.SubElement(
            heading_param, "{%s}waypointHeadingMode" % self.WPML_NAMESPACE
        ).text = "followWayline"
        ET.SubElement(
            heading_param, "{%s}waypointHeadingAngle" % self.WPML_NAMESPACE
        ).text = "0"
        ET.SubElement(
            heading_param, "{%s}waypointPoiPoint" % self.WPML_NAMESPACE
        ).text = "0.000000,0.000000,0.000000"
        ET.SubElement(
            heading_param, "{%s}waypointHeadingPathMode" % self.WPML_NAMESPACE
        ).text = "followBadArc"

        # Global waypoint turn mode
        ET.SubElement(
            folder, "{%s}globalWaypointTurnParam" % self.WPML_NAMESPACE
        )
        turn_param = folder.find("{%s}globalWaypointTurnParam" % self.WPML_NAMESPACE)
        ET.SubElement(
            turn_param, "{%s}waypointTurnMode" % self.WPML_NAMESPACE
        ).text = "coordinateTurn"
        ET.SubElement(
            turn_param, "{%s}waypointTurnDampingDist" % self.WPML_NAMESPACE
        ).text = "0.2"

        # Add placemarks for each waypoint
        for wp in self.waypoints:
            placemark = self._create_template_placemark(wp)
            folder.append(placemark)

        return self._prettify(kml)

    def build_waylines_wpml(self) -> str:
        """
        Generate waylines.wpml content.

        This file contains the executable waypoint data.
        """
        ET.register_namespace("", self.WPML_NAMESPACE)

        # Root element
        kml = ET.Element("kml", {
            "xmlns": self.KML_NAMESPACE,
            "xmlns:wpml": self.WPML_NAMESPACE,
        })

        document = ET.SubElement(kml, "Document")

        # Mission info
        ET.SubElement(document, "{%s}author" % self.WPML_NAMESPACE).text = "GeoFlight Planner"
        ET.SubElement(document, "{%s}createTime" % self.WPML_NAMESPACE).text = str(
            int(datetime.now().timestamp() * 1000)
        )
        ET.SubElement(document, "{%s}updateTime" % self.WPML_NAMESPACE).text = str(
            int(datetime.now().timestamp() * 1000)
        )

        # Mission config (duplicate from template)
        mission_config = ET.SubElement(document, "{%s}missionConfig" % self.WPML_NAMESPACE)
        ET.SubElement(mission_config, "{%s}flyToWaylineMode" % self.WPML_NAMESPACE).text = "safely"
        ET.SubElement(mission_config, "{%s}finishAction" % self.WPML_NAMESPACE).text = "goHome"
        ET.SubElement(mission_config, "{%s}exitOnRCLost" % self.WPML_NAMESPACE).text = "executeLostAction"
        ET.SubElement(mission_config, "{%s}executeRCLostAction" % self.WPML_NAMESPACE).text = "goBack"
        ET.SubElement(mission_config, "{%s}globalTransitionalSpeed" % self.WPML_NAMESPACE).text = "10"

        drone_info = ET.SubElement(mission_config, "{%s}droneInfo" % self.WPML_NAMESPACE)
        ET.SubElement(drone_info, "{%s}droneEnumValue" % self.WPML_NAMESPACE).text = str(
            self.camera.drone_enum_value
        )
        ET.SubElement(drone_info, "{%s}droneSubEnumValue" % self.WPML_NAMESPACE).text = "0"

        payload_info = ET.SubElement(mission_config, "{%s}payloadInfo" % self.WPML_NAMESPACE)
        ET.SubElement(payload_info, "{%s}payloadEnumValue" % self.WPML_NAMESPACE).text = str(
            self.camera.payload_enum_value
        )
        ET.SubElement(payload_info, "{%s}payloadSubEnumValue" % self.WPML_NAMESPACE).text = "0"
        ET.SubElement(payload_info, "{%s}payloadPositionIndex" % self.WPML_NAMESPACE).text = "0"

        # Folder with wayline
        folder = ET.SubElement(document, "Folder")
        ET.SubElement(folder, "{%s}templateId" % self.WPML_NAMESPACE).text = "0"
        ET.SubElement(folder, "{%s}executeHeightMode" % self.WPML_NAMESPACE).text = "relativeToStartPoint"
        ET.SubElement(folder, "{%s}waylineId" % self.WPML_NAMESPACE).text = "0"
        ET.SubElement(folder, "{%s}distance" % self.WPML_NAMESPACE).text = "0"
        ET.SubElement(folder, "{%s}duration" % self.WPML_NAMESPACE).text = "0"
        ET.SubElement(folder, "{%s}autoFlightSpeed" % self.WPML_NAMESPACE).text = str(
            self.waypoints[0].speed if self.waypoints else 5.0
        )

        # Add placemarks
        for wp in self.waypoints:
            placemark = self._create_wpml_placemark(wp)
            folder.append(placemark)

        return self._prettify(kml)

    def _create_template_placemark(self, wp: Waypoint) -> ET.Element:
        """Create a Placemark element for template.kml."""
        placemark = ET.Element("Placemark")

        # Point geometry
        point = ET.SubElement(placemark, "Point")
        ET.SubElement(point, "coordinates").text = f"{wp.longitude},{wp.latitude}"

        # Waypoint index
        ET.SubElement(placemark, "{%s}index" % self.WPML_NAMESPACE).text = str(wp.index)

        # Execute height (altitude)
        ET.SubElement(
            placemark, "{%s}executeHeight" % self.WPML_NAMESPACE
        ).text = str(wp.altitude)

        # Waypoint speed
        ET.SubElement(
            placemark, "{%s}waypointSpeed" % self.WPML_NAMESPACE
        ).text = str(wp.speed)

        # Heading parameters
        heading_param = ET.SubElement(
            placemark, "{%s}waypointHeadingParam" % self.WPML_NAMESPACE
        )
        ET.SubElement(
            heading_param, "{%s}waypointHeadingMode" % self.WPML_NAMESPACE
        ).text = "smoothTransition"
        ET.SubElement(
            heading_param, "{%s}waypointHeadingAngle" % self.WPML_NAMESPACE
        ).text = str(int(wp.heading))
        ET.SubElement(
            heading_param, "{%s}waypointPoiPoint" % self.WPML_NAMESPACE
        ).text = "0.000000,0.000000,0.000000"
        ET.SubElement(
            heading_param, "{%s}waypointHeadingPathMode" % self.WPML_NAMESPACE
        ).text = "followBadArc"

        # Turn parameters
        turn_param = ET.SubElement(
            placemark, "{%s}waypointTurnParam" % self.WPML_NAMESPACE
        )
        ET.SubElement(
            turn_param, "{%s}waypointTurnMode" % self.WPML_NAMESPACE
        ).text = "coordinateTurn"
        ET.SubElement(
            turn_param, "{%s}waypointTurnDampingDist" % self.WPML_NAMESPACE
        ).text = "0.2"

        # Gimbal pitch mode
        ET.SubElement(
            placemark, "{%s}useStraightLine" % self.WPML_NAMESPACE
        ).text = "1"

        # Actions
        if wp.take_photo:
            action_group = ET.SubElement(
                placemark, "{%s}actionGroup" % self.WPML_NAMESPACE
            )
            ET.SubElement(
                action_group, "{%s}actionGroupId" % self.WPML_NAMESPACE
            ).text = str(wp.index)
            ET.SubElement(
                action_group, "{%s}actionGroupStartIndex" % self.WPML_NAMESPACE
            ).text = str(wp.index)
            ET.SubElement(
                action_group, "{%s}actionGroupEndIndex" % self.WPML_NAMESPACE
            ).text = str(wp.index)
            ET.SubElement(
                action_group, "{%s}actionGroupMode" % self.WPML_NAMESPACE
            ).text = "sequence"
            ET.SubElement(
                action_group, "{%s}actionTrigger" % self.WPML_NAMESPACE
            )
            trigger = action_group.find("{%s}actionTrigger" % self.WPML_NAMESPACE)
            ET.SubElement(
                trigger, "{%s}actionTriggerType" % self.WPML_NAMESPACE
            ).text = "reachPoint"

            # Gimbal rotate action
            gimbal_action = ET.SubElement(action_group, "{%s}action" % self.WPML_NAMESPACE)
            ET.SubElement(
                gimbal_action, "{%s}actionId" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_action, "{%s}actionActuatorFunc" % self.WPML_NAMESPACE
            ).text = "gimbalRotate"
            gimbal_param = ET.SubElement(
                gimbal_action, "{%s}actionActuatorFuncParam" % self.WPML_NAMESPACE
            )
            ET.SubElement(
                gimbal_param, "{%s}gimbalRotateMode" % self.WPML_NAMESPACE
            ).text = "absoluteAngle"
            ET.SubElement(
                gimbal_param, "{%s}gimbalPitchRotateEnable" % self.WPML_NAMESPACE
            ).text = "1"
            ET.SubElement(
                gimbal_param, "{%s}gimbalPitchRotateAngle" % self.WPML_NAMESPACE
            ).text = str(int(wp.gimbal_pitch))
            ET.SubElement(
                gimbal_param, "{%s}gimbalRollRotateEnable" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}gimbalRollRotateAngle" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}gimbalYawRotateEnable" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}gimbalYawRotateAngle" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}gimbalRotateTimeEnable" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}gimbalRotateTime" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}payloadPositionIndex" % self.WPML_NAMESPACE
            ).text = "0"

            # Take photo action
            photo_action = ET.SubElement(action_group, "{%s}action" % self.WPML_NAMESPACE)
            ET.SubElement(
                photo_action, "{%s}actionId" % self.WPML_NAMESPACE
            ).text = "1"
            ET.SubElement(
                photo_action, "{%s}actionActuatorFunc" % self.WPML_NAMESPACE
            ).text = "takePhoto"
            photo_param = ET.SubElement(
                photo_action, "{%s}actionActuatorFuncParam" % self.WPML_NAMESPACE
            )
            ET.SubElement(
                photo_param, "{%s}payloadPositionIndex" % self.WPML_NAMESPACE
            ).text = "0"

        return placemark

    def _create_wpml_placemark(self, wp: Waypoint) -> ET.Element:
        """Create a Placemark element for waylines.wpml."""
        placemark = ET.Element("Placemark")

        # Point geometry
        point = ET.SubElement(placemark, "Point")
        ET.SubElement(point, "coordinates").text = f"{wp.longitude},{wp.latitude}"

        # Index
        ET.SubElement(placemark, "{%s}index" % self.WPML_NAMESPACE).text = str(wp.index)

        # Execute height
        ET.SubElement(
            placemark, "{%s}executeHeight" % self.WPML_NAMESPACE
        ).text = str(wp.altitude)

        # Waypoint speed
        ET.SubElement(
            placemark, "{%s}waypointSpeed" % self.WPML_NAMESPACE
        ).text = str(wp.speed)

        # Heading param
        heading_param = ET.SubElement(
            placemark, "{%s}waypointHeadingParam" % self.WPML_NAMESPACE
        )
        ET.SubElement(
            heading_param, "{%s}waypointHeadingMode" % self.WPML_NAMESPACE
        ).text = "smoothTransition"
        ET.SubElement(
            heading_param, "{%s}waypointHeadingAngle" % self.WPML_NAMESPACE
        ).text = str(int(wp.heading))
        ET.SubElement(
            heading_param, "{%s}waypointHeadingPathMode" % self.WPML_NAMESPACE
        ).text = "followBadArc"

        # Turn param
        turn_param = ET.SubElement(
            placemark, "{%s}waypointTurnParam" % self.WPML_NAMESPACE
        )
        ET.SubElement(
            turn_param, "{%s}waypointTurnMode" % self.WPML_NAMESPACE
        ).text = "coordinateTurn"
        ET.SubElement(
            turn_param, "{%s}waypointTurnDampingDist" % self.WPML_NAMESPACE
        ).text = "0.2"

        ET.SubElement(
            placemark, "{%s}useStraightLine" % self.WPML_NAMESPACE
        ).text = "1"

        # Actions (same structure as template)
        if wp.take_photo:
            action_group = ET.SubElement(
                placemark, "{%s}actionGroup" % self.WPML_NAMESPACE
            )
            ET.SubElement(
                action_group, "{%s}actionGroupId" % self.WPML_NAMESPACE
            ).text = str(wp.index)
            ET.SubElement(
                action_group, "{%s}actionGroupStartIndex" % self.WPML_NAMESPACE
            ).text = str(wp.index)
            ET.SubElement(
                action_group, "{%s}actionGroupEndIndex" % self.WPML_NAMESPACE
            ).text = str(wp.index)
            ET.SubElement(
                action_group, "{%s}actionGroupMode" % self.WPML_NAMESPACE
            ).text = "sequence"
            ET.SubElement(
                action_group, "{%s}actionTrigger" % self.WPML_NAMESPACE
            )
            trigger = action_group.find("{%s}actionTrigger" % self.WPML_NAMESPACE)
            ET.SubElement(
                trigger, "{%s}actionTriggerType" % self.WPML_NAMESPACE
            ).text = "reachPoint"

            # Gimbal action
            gimbal_action = ET.SubElement(action_group, "{%s}action" % self.WPML_NAMESPACE)
            ET.SubElement(gimbal_action, "{%s}actionId" % self.WPML_NAMESPACE).text = "0"
            ET.SubElement(
                gimbal_action, "{%s}actionActuatorFunc" % self.WPML_NAMESPACE
            ).text = "gimbalRotate"
            gimbal_param = ET.SubElement(
                gimbal_action, "{%s}actionActuatorFuncParam" % self.WPML_NAMESPACE
            )
            ET.SubElement(
                gimbal_param, "{%s}gimbalRotateMode" % self.WPML_NAMESPACE
            ).text = "absoluteAngle"
            ET.SubElement(
                gimbal_param, "{%s}gimbalPitchRotateEnable" % self.WPML_NAMESPACE
            ).text = "1"
            ET.SubElement(
                gimbal_param, "{%s}gimbalPitchRotateAngle" % self.WPML_NAMESPACE
            ).text = str(int(wp.gimbal_pitch))
            ET.SubElement(
                gimbal_param, "{%s}gimbalRollRotateEnable" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}gimbalRollRotateAngle" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}gimbalYawRotateEnable" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}gimbalYawRotateAngle" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}gimbalRotateTimeEnable" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}gimbalRotateTime" % self.WPML_NAMESPACE
            ).text = "0"
            ET.SubElement(
                gimbal_param, "{%s}payloadPositionIndex" % self.WPML_NAMESPACE
            ).text = "0"

            # Take photo action
            photo_action = ET.SubElement(action_group, "{%s}action" % self.WPML_NAMESPACE)
            ET.SubElement(photo_action, "{%s}actionId" % self.WPML_NAMESPACE).text = "1"
            ET.SubElement(
                photo_action, "{%s}actionActuatorFunc" % self.WPML_NAMESPACE
            ).text = "takePhoto"
            photo_param = ET.SubElement(
                photo_action, "{%s}actionActuatorFuncParam" % self.WPML_NAMESPACE
            )
            ET.SubElement(
                photo_param, "{%s}payloadPositionIndex" % self.WPML_NAMESPACE
            ).text = "0"

        return placemark

    def _prettify(self, elem: ET.Element) -> str:
        """Return prettified XML string."""
        rough_string = ET.tostring(elem, encoding="unicode")
        reparsed = minidom.parseString(rough_string)
        return reparsed.toprettyxml(indent="  ", encoding=None)
