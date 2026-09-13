from django.urls import re_path
from . import views

urlpatterns = [
    re_path(r'^auth/entra-verify/?$',        views.entra_verify_view,   name='entra-verify'),
    re_path(r'^auth/verify/?$',              views.entra_verify_view,   name='entra-verify-alias'),
    re_path(r'^vms/?$',                      views.vm_list_view,        name='vm-list'),
    re_path(r'^vms/create/?$',               views.vm_create_view, name='vm-create'),
    re_path(r'^vms/(?P<vm_id>[^/]+)/action/?$', views.vm_action_view, name='vm-action'),
    re_path(r'^azure/status/?$',             views.azure_status_view, name='azure-status'),
    re_path(r'^azure/resource-groups/?$',    views.azure_resource_groups_view, name='azure-resource-groups'),
    re_path(r'^azure/networks/?$',           views.azure_networks_view, name='azure-networks'),
    re_path(r'^azure/skus/?$',               views.azure_skus_view, name='azure-skus'),
    re_path(r'^health/?$',                   views.health_view,    name='health'),
]
