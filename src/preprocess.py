"""Schema constants used by artifact inference."""

from .features import SENSOR_COLUMNS

MODEL_RAW_COLUMNS = ["date", "Appliances", *SENSOR_COLUMNS]
