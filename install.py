#!/usr/bin/env python3

import click
import subprocess
import json
import sys
import os
import tempfile

from jinja2 import Template
from pprint import pprint

@click.command()
@click.argument("service")
@click.option("--print-only", is_flag=True)
def main(service, print_only):

    raw_template = subprocess.check_output(["kubectl", "kustomize", service])
    template = Template(raw_template.decode())

    script_dir = os.path.dirname(__file__)
    with open(f"{script_dir}/settings.json") as f:
        settings = json.load(f)

    rendered_template = template.render(settings)

    if print_only:
        print(rendered_template)
        sys.exit(0)

    temp_file = tempfile.mktemp()
    with open(temp_file, "w") as f:
        f.write(rendered_template)

    subprocess.call(["kubectl", "apply", "-f", temp_file])


if __name__ == "__main__":
    main()
