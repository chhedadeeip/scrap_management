from setuptools import setup, find_packages

version = "0.0.2"

setup(
    name="scrap_management",
    version=version,
    description="Scrap Management for ERPNext",
    author="Stallion Bulk Tech",
    author_email="info@stallionbulktech.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=[],
)
