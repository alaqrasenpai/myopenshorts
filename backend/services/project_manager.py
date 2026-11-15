import json
import uuid
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from config import PROJECTS_FILE

class ProjectManager:
    def __init__(self, filepath: Path = PROJECTS_FILE):
        self.filepath = filepath
        self._ensure_file()

    def _ensure_file(self):
        if not self.filepath.exists():
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump({}, f)

    def _read_all(self) -> Dict[str, Any]:
        try:
            if self.filepath.exists():
                with open(self.filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    def _write_all(self, data: Dict[str, Any]):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def create_project(self, title: str, source_type: str, source_url: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        project_id = str(uuid.uuid4())[:8]
        project = {
            "id": project_id,
            "title": title or "New Stream Project",
            "source_type": source_type,  # "url" or "upload"
            "source_url": source_url or "",
            "status": "created",  # created, downloading, processing, ready, error
            "progress": 0,
            "status_message": "Project created",
            "video_path": "",
            "audio_path": "",
            "metadata": metadata or {},
            "facecam_info": None,
            "clips": [],
            "created_at": time.time(),
            "updated_at": time.time()
        }
        all_projects = self._read_all()
        all_projects[project_id] = project
        self._write_all(all_projects)
        return project

    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        all_projects = self._read_all()
        return all_projects.get(project_id)

    def list_projects(self) -> List[Dict[str, Any]]:
        all_projects = self._read_all()
        projects_list = list(all_projects.values())
        projects_list.sort(key=lambda x: x.get("created_at", 0), reverse=True)
        return projects_list

    def update_project(self, project_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        all_projects = self._read_all()
        if project_id in all_projects:
            all_projects[project_id].update(updates)
            all_projects[project_id]["updated_at"] = time.time()
            self._write_all(all_projects)
            return all_projects[project_id]
        return None

    def delete_project(self, project_id: str) -> bool:
        all_projects = self._read_all()
        if project_id in all_projects:
            del all_projects[project_id]
            self._write_all(all_projects)
            return True
        return False

project_manager = ProjectManager()
